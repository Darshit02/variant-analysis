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

export async function getAvailableGenomes() {
  const apiUrl = `${process.env.NEXT_UCSC_API_URL}/ucscGenomes`;

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
  const apiUrl = `${process.env.NEXT_UCSC_API_URL}/chromosomes?genome=${genomeId}`;
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
