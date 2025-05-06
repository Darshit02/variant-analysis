import sys
import modal

evo2_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.12"
    )
    .apt_install(
        ["build-essential", "cmake", "ninja-build",
            "libcudnn8", "libcudnn8-dev", "git", "gcc", "g++"]
    )
    .env({
        "CC": "/usr/bin/gcc",
        "CXX": "/usr/bin/g++",
    })
    .run_commands("git clone --recurse-submodules https://github.com/ArcInstitute/evo2.git && cd evo2 && pip install .")
    .run_commands("pip uninstall -y transformer-engine transformer_engine")
    .run_commands("pip install 'transformer_engine[pytorch]==1.13' --no-build-isolation")
    .pip_install_from_requirements("requirements.txt")
)

app = modal.App("variant-analysis-evo2", image=evo2_image)

volume = modal.Volume.from_name("hf_cache", create_if_missing=True)
mount_path = "/root/.cache/huggingface"


@app.function(gpu="H100", volumes={mount_path: volume}, timeout=1000)
def run_brca1_analysis():
    import base64
    from io import BytesIO
    from Bio import SeqIO
    import gzip
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    import os
    import seaborn as sns
    from sklearn.metrics import roc_auc_score, roc_curve

    from evo2 import Evo2

    WINDOW_SIZE = 8192

    print("Loading evo2 Modal...")
    model = Evo2("evo2_7b")
    print("Evo2 Modal loaded.")

    brca1_df = pd.read_excel(
        '/evo2/notebooks/brca1/41586_2018_461_MOESM3_ESM.xlsx',
        header=2,
    )

    brca1_df = brca1_df[[
        'chromosome', 'position (hg19)', 'reference', 'alt', 'function.score.mean', 'func.class',
    ]]
    brca1_df.rename(columns={
        'chromosome': 'chrom',
        'position (hg19)': 'pos',
        'reference': 'ref',
        'alt': 'alt',
        'function.score.mean': 'score',
        'func.class': 'class',
    }, inplace=True)

    # Convert to two-class system
    brca1_df['class'] = brca1_df['class'].replace(['FUNC', 'INT'], 'FUNC/INT')

    with gzip.open('/evo2/notebooks/brca1/GRCh37.p13_chr17.fna.gz', "rt") as handle:
        for record in SeqIO.parse(handle, "fasta"):
            seq_chr17 = str(record.seq)
            break

    # Build mappings of unique reference sequences
    ref_seqs = []
    ref_seq_to_index = {}

    # Parse sequences and store indexes
    ref_seq_indexes = []
    var_seqs = []

    brca1_subset = brca1_df.iloc[:500].copy()

    for _, row in brca1_subset.iterrows():
        p = row["pos"] - 1
        # Convert to 0-indexed position
        full_seq = seq_chr17

        ref_seq_start = max(0, p - WINDOW_SIZE//2)
        ref_seq_end = min(len(full_seq), p + WINDOW_SIZE//2)
        ref_seq = seq_chr17[ref_seq_start:ref_seq_end]
        snv_pos_in_ref = min(WINDOW_SIZE//2, p)
        var_seq = ref_seq[:snv_pos_in_ref] + \
            row["alt"] + ref_seq[snv_pos_in_ref+1:]

        # Get or create index for reference sequence
        if ref_seq not in ref_seq_to_index:
            ref_seq_to_index[ref_seq] = len(ref_seqs)
            ref_seqs.append(ref_seq)

        ref_seq_indexes.append(ref_seq_to_index[ref_seq])
        var_seqs.append(var_seq)

    ref_seq_indexes = np.array(ref_seq_indexes)

    print(
        f'Scoring likelihoods of {len(ref_seqs)} reference sequences with Evo 2...')
    ref_scores = model.score_sequences(ref_seqs)

    print(
        f'Scoring likelihoods of {len(var_seqs)} variant sequences with Evo 2...')
    var_scores = model.score_sequences(var_seqs)

    delta_scores = np.array(var_scores) - np.array(ref_scores)[ref_seq_indexes]
    brca1_subset[f'evo2_delta_score'] = delta_scores

    y_true = (brca1_subset['class'] == 'LOF')
    auroc = roc_auc_score(y_true, -brca1_subset['evo2_delta_score'])

    plt.figure(figsize=(4, 2))

    # ----> Calculate threshold

    y_true = (brca1_subset["class"] == "LOF")

    fpr, tpr, thresholds = roc_curve(y_true, -brca1_subset["evo2_delta_score"])

    optimal_idx = (tpr - fpr).argmax()

    optimal_threshold = -thresholds[optimal_idx]

    lof_scores = brca1_subset.loc[brca1_subset["class"]
                                  == "LOF", "evo2_delta_score"]
    func_int_scores = brca1_subset.loc[brca1_subset["class"]
                                       == "FUNC/INT", "evo2_delta_score"]

    lof_std = lof_scores.std()
    func_int_std = func_int_scores.std()

    confidence_params = {
        "threshold": optimal_threshold,
        "lof_std": lof_std,
        "func_int_std": func_int_std,
    }

    print("Confidence params:", confidence_params)
    # ----> Calculate threshold end

# Plot stripplot of distributions
    p = sns.stripplot(
        data=brca1_subset,
        x='evo2_delta_score',
        y='class',
        hue='class',
        order=['FUNC/INT', 'LOF'],
        palette=['#777777', 'C3'],
        size=2,
        jitter=0.3,
    )

    # Mark medians from each distribution
    sns.boxplot(showmeans=True,
                meanline=True,
                meanprops={'visible': False},
                medianprops={'color': 'k', 'ls': '-', 'lw': 2},
                whiskerprops={'visible': False},
                zorder=10,
                x="evo2_delta_score",
                y="class",
                data=brca1_subset,
                showfliers=False,
                showbox=False,
                showcaps=False,
                ax=p)
    plt.xlabel('Delta likelihood score, Evo 2')
    plt.ylabel('BRCA1 SNV class')
    plt.tight_layout()

    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    plot_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return {'varinents': brca1_subset.to_dict(orient="records"), "plot": plot_data, "auroc": auroc}


@app.function()
def brca1_example():
    import base64
    import matplotlib.pyplot as plt
    from io import BytesIO
    import matplotlib.image as mpimg
    print("Running BRCA1 variant analysis with Evo2...")

    # Run infrence
    result = run_brca1_analysis.remote()

    if "plot" in result:
        plt_data = base64.b64decode(result["plot"])
        with open("brca1_analysis_plot.png", "wb") as f:
            f.write(plt_data)

        img = mpimg.imread(BytesIO(plt_data))
        plt.figure(figsize=(10, 5))
        plt.imshow(img)
        plt.axis('off')
        plt.show()


def get_genome_sequence(postion, genome: str, chrmosome: str, window_size=8192):
    import requests

    half_window = window_size//2
    start = max(0, postion - 1 - half_window)
    end = postion - 1 + half_window + 1

    print(
        f"Featching {window_size}bp window around position {postion} form UCSC API..")
    print(f"Coordinates: {chrmosome}:{start}-{end} ({genome}) ")

    api_url = f"https://api.genome.ucsc.edu/getData/sequence?genome={genome};chrom={chrmosome};start={start};end={end}"
    response = requests.get(api_url)

    if response.status_code != 200:
        raise Exception(
            f"Failed to fetch genome sequence from UCSC API: {response.status_code}")

    genome_data = response.json()

    if "dna" not in genome_data:
        error = genome_data.get("error", "Unkown Error")
        raise Exception(f"UCSC API error : {error}")

    sequence = genome_data.get("dna", "").upper()
    excepted_legnth = end - start
    if len(sequence) != excepted_legnth:
        print(
            f"Warning: recived sequence length ({len(sequence)}) differs from expected ({excepted_legnth})")

    print(
        f"loded refrence genome sequence window (length : {len(sequence)} bases)")

    return sequence, start


def analyze_variant(relative_pos_in_window, reference, alternative, window_seq, model):
    var_seq = window_seq[:relative_pos_in_window] + \
        alternative + window_seq[relative_pos_in_window+1:]

    ref_score = model.score_sequences([window_seq])[0]
    var_score = model.score_sequences([var_seq])[0]

    delta_score = var_score - ref_score

    threshold = -0.0009178519
    lof_std = 0.0015140239
    func_std = 0.0009016589

    if delta_score < threshold:
        prediction = "Likely pathogenic"
        confidence = min(1.0, abs(delta_score - threshold) / lof_std)
    else:
        prediction = "Likely benign"
        confidence = min(1.0, abs(delta_score - threshold) / func_std)

    return {
        "reference": reference,
        "alternative": alternative,
        "delta_score": float(delta_score),
        "prediction": prediction,
        "classification_confidence": float(confidence)
    }


@app.cls(gpu="H100", volumes={mount_path: volume}, max_containers=3, retries=2, scaledown_window=120)
class Evo2Model:
    @modal.enter()
    def load_evo2_model(self):
        from evo2 import Evo2
        print("Loading evo2 modal...")
        self.model = Evo2('evo2_7b')
        print("Evo2 model loaded")

    # @modal.method()
    @modal.fastapi_endpoint(method="POST")
    def analyze_single_variant(self, variant_position: int, alternative: str, genome: str, chromosome: str):
        print("Genome :", genome)
        print("chromosome :", chromosome)
        print("chrmomsome positions:", variant_position)
        print("chrmomsome alternative:", alternative)

        WINDOW_SIZE = 8192

        # Scoring

        window_seq, seq_start = get_genome_sequence(
            postion=variant_position,
            genome=genome,
            chrmosome=chromosome,
            window_size=WINDOW_SIZE
        )

        print(
            f"Fetched genome sequence window , first 100 : {window_seq[:100]}")

        relative_pos = variant_position - 1 - seq_start

        print(f"Relative postion within window : {relative_pos}")

        if relative_pos < 0 or relative_pos >= len(window_seq):
            raise ValueError(
                f"Varient position {variant_position} is outside the fetched window (start = {seq_start + 1} , end = {seq_start+len(window_seq)})")

        refrence = window_seq[relative_pos]
        print("Refrence is:" + refrence)

        # Analyze the variant

        result = analyze_variant(
            relative_pos_in_window=relative_pos,
            reference=refrence,
            alternative=alternative,
            window_seq=window_seq,
            model=self.model
        )

        result["position"] = variant_position

        print("Result:", result)
        return result


@app.local_entrypoint()
def main():
    evo2Model = Evo2Model()
    results = evo2Model.analyze_single_variant.remote(
        variant_position=43119628,alternative="G", genome="hg38", chromosome="chr17"
    )

    print("Results:","classification:" + str(results["classification_confidence"]))