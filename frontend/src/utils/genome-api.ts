"use server";


export interface GenomeAssemblyFromSearch {
  id: string;
  name: string;
  sourceName: string;
  active: boolean;
}

export async function getAcailableGenomes() {
    
  const apiUrl = "https://api.genome.ucsc.edu/list/ucscGenomes";
  
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
  }
}
