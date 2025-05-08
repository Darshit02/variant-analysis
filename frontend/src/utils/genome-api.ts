"use server";

export interface GenomeAssemblyFromSearch {
  id: string;
  name: string;
  sourceName: string;
  active: boolean;
}

export interface ChromosomeFromSearch {
  name: string;
  size: number;
}
export interface GeneFromSearch {
  symbol: string;
  name: string;
  chromosome: string;
  description: string;
  gene_id?: string;
}

export interface GeneDetailsFromSearch {
  genomicinfo: {
    chrstart: number;
    chrstop: number;
    strand?: string;
  }[];
  summary?: string;
  organism?: {
    scientificname: string;
    commonname: string;
  };
}

export interface GeneBounds {
  min: number;
  max: number;
}

export async function getAvailableGenomes() {
  const apiUrl = `${process.env.NEXT_UCSC_API_URL}/list/ucscGenomes`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch genome assemblies");
  }
  const genomeData = await response.json();
  if (!genomeData || !genomeData.ucscGenomes) {
    throw new Error("Invalid genome data");
  }

  const genomes = genomeData.ucscGenomes;
  const structuredGenomes: Record<string, GenomeAssemblyFromSearch[]> = {};

  for (const genomeId in genomes) {
    const genomeInfo = genomes[genomeId];
    const organism = genomeInfo.organism || "other";

    if (!structuredGenomes[organism]) structuredGenomes[organism] = [];
    structuredGenomes[organism].push({
      id: genomeId,
      name: genomeInfo.description || genomeId,
      sourceName: genomeInfo.sourceName || genomeId,
      active: !!genomeInfo.active, // Assuming 'active' is a boolean property
    });
  }

  return {
    genomes: structuredGenomes,
  };
}

export async function getGenomeChromosomes(genomeId: string) {
  const apiUrl = `${process.env.NEXT_UCSC_API_URL}/list/chromosomes?genome=${genomeId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch genome assemblies");
  }
  const genomeData = await response.json();
  if (!genomeData || !genomeData.chromosomes) {
    throw new Error("Invalid genome data");
  }

  const chromosomes: ChromosomeFromSearch[] = [];

  for (const chromosomeId in genomeData.chromosomes) {
    if (
      chromosomeId.includes("_") ||
      chromosomeId.includes("Un") ||
      chromosomeId.includes("random")
    )
      continue;
    chromosomes.push({
      name: chromosomeId,
      size: genomeData.chromosomes[chromosomeId],
    });
  }

  //chr1 , chr2, chr3, chr4, chr5, chr6, chr7, chr8, chr9, chr10, chr11, chr12, chr13, chr14, chr15, chr16, chr17, chr18, chr19, chr20, chr21, chr22

  chromosomes.sort((a, b) => {
    const anum = a.name.replace("chr", "");
    const bnum = b.name.replace("chr", "");
    const isNumA = /^\d+$/.test(anum);
    const isNumB = /^\d+$/.test(bnum);
    if (isNumA && isNumB) return Number(anum) - Number(bnum);
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;
    return anum.localeCompare(bnum);
  });

  return {
    chromosomes: chromosomes,
  };
}

export async function searchGenes(query: string, genome: string) {
  const url = `${process.env.NEXT_GENES_URL}`;
  const params = new URLSearchParams({
    terms: query,
    df: "chromosome,Symbol,description,map_location,type_of_gene",
    ef: "chromosome,Symbol,description,map_location,type_of_gene,GenomicInfo,GeneID",
  });
  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    throw new Error("NCBI API Error");
  }

  const data = await response.json();
  const results: GeneFromSearch[] = [];

  if (data[0] > 0) {
    const fieldMap = data[2];
    const geneIds = fieldMap.GeneID || [];
    for (let i = 0; i < Math.min(10, data[0]); ++i) {
      try {
        const display = data[3][i];
        let chrom = display[0];
        if (chrom && !chrom.startsWith("chr")) {
          chrom = `chr${chrom}`;
        }
        results.push({
          symbol: display[2],
          name: display[3],
          chromosome: chrom,
          description: display[3],
          gene_id: geneIds[i] || "",
        });
      } catch (e) {
        continue;
      }
    }
  }
  return { query, genome, results };
}

export async function fetchGeneDetails(geneId: string): Promise<{
  geneDetails: GeneDetailsFromSearch | null;
  geneBounds: GeneBounds | null;
  initialRange: { start: number; end: number } | null;
}> {
  try {
    const detailUrl = `${process.env.NEXT_GENES_SUMMARY_URL}/entrez/eutils/esummary.fcgi?db=gene&id=${geneId}&retmode=json`;
    const detailsResponse = await fetch(detailUrl);

    if (!detailsResponse.ok) {
      console.error(
        `Failed to fetch gene details: ${detailsResponse.statusText}`,
      );
      return { geneDetails: null, geneBounds: null, initialRange: null };
    }

    const detailData = await detailsResponse.json();

    if (detailData.result && detailData.result[geneId]) {
      const detail = detailData.result[geneId];

      if (detail.genomicinfo && detail.genomicinfo.length > 0) {
        const info = detail.genomicinfo[0];

        const minPos = Math.min(info.chrstart, info.chrstop);
        const maxPos = Math.max(info.chrstart, info.chrstop);
        const bounds = { min: minPos, max: maxPos };

        const geneSize = maxPos - minPos;
        const seqStart = minPos;
        const seqEnd = geneSize > 10000 ? minPos + 10000 : maxPos;
        const range = { start: seqStart, end: seqEnd };

        return { geneDetails: detail, geneBounds: bounds, initialRange: range };
      }
    }

    return { geneDetails: null, geneBounds: null, initialRange: null };
  } catch (err) {
    return { geneDetails: null, geneBounds: null, initialRange: null };
  }
}

export async function fetchGeneSequence(
  chrom: string,
  start: number,
  end: number,
  genomeId: string,
): Promise<{
  sequence: string;
  actualRange: { start: number; end: number };
  error?: string;
}> {
  try {
    const chromosome = chrom.startsWith("chr") ? chrom : `chr${chrom}`;

    const apiStart = start - 1;
    const apiEnd = end;

    const apiUrl = `${process.env.NEXT_UCSC_API_URL}/getData/sequence?genome=${genomeId};chrom=${chromosome};start=${apiStart};end=${apiEnd}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const actualRange = { start, end };

    if (data.error || !data.dna) {
      return { sequence: "", actualRange, error: data.error };
    }

    const sequence = data.dna.toUpperCase();

    return { sequence, actualRange };
  } catch (err) {
    return {
      sequence: "",
      actualRange: { start, end },
      error: "Internal error in fetch gene sequence",
    };
  }
}
