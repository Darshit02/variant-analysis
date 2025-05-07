"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getAvailableGenomes,
  getGenomeChromosomes,
  type ChromosomeFromSearch,
  type GenomeAssemblyFromSearch,
} from "~/utils/genome-api";

export default function HomePage() {
  const [genomes, setGenomes] = useState<GenomeAssemblyFromSearch[]>([]);
  const [chromosomes, setChromosomes] = useState<ChromosomeFromSearch[]>([]);
  const [selectedChromosome, setSelectedChromosome] = useState<string>("chr1");
  const [selectedGenome, setSelectedGenome] = useState<string>("hg38");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGenomes = async () => {
      try {
        setIsLoading(true);
        const data = await getAvailableGenomes();
        if (data.genomes && data.genomes["Human"]) {
          setGenomes(data.genomes["Human"]);
        }
      } catch (error) {
        console.error("Error fetching genomes:", error);
        setError("Failed to fetch genome assemblies");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGenomes();
  }, []);

  useEffect(() => {
    const fetchChromosoms = async () => {
      try {
        setIsLoading(true);
        const data = await getGenomeChromosomes(selectedGenome);
        setChromosomes(data.chromosomes);
        if (data.chromosomes.length > 0) {
          setSelectedChromosome(data.chromosomes[0]!.name);
          console.log("Chromosomes:", data.chromosomes);
        }
      } catch (error) {
        console.error("Error fetching chromosoms:", error);
        setError("Failed to fetch chromosoms ");
      } finally {
        setIsLoading(false);
      }
    };
    fetchChromosoms();
  }, [selectedGenome]);

  const handleGenomeChange = (value: string) => {
    setSelectedGenome(value);
  };

  return (
    <div className="min-h-screen bg-[#e9eeea]">
      <header className="border-b border-[#3c4f3d]/10 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <h1 className="text-xl font-light tracking-wide text-[#3c4f3d]">
                <span className="font-normal">EVO</span>
                <span className="text-[#de8246]">2</span>
              </h1>
              <div className="absolute -bottom-1 left-0 h-[2px] w-12 bg-[#de8246]"></div>
            </div>
            <span className="text-sm font-light text-[#3c4f3d]/70">
              Variant Analysis
            </span>
          </div>
        </div>
      </header>
      {/* Main content */}
      <main className="container mx-auto px-6 py-6">
        <Card className="mb-6 gap-0 border-none bg-white py-0 shadow-sm">
          <CardHeader className="pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-normal text-[#3c4f3d]/70">
                Genome Assembly
              </CardTitle>
              <div className="text-xs text-[#3c4f3d]/60">
                Organism: <span className="font-medium">Human</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <Select
              value={selectedGenome}
              onValueChange={handleGenomeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-9 w-full border-[#3c4f3d]/10">
                <SelectValue placeholder="Select genome assembly" />
              </SelectTrigger>
              <SelectContent>
                {genomes.map((genome) => (
                  <SelectItem key={genome.id} value={genome.id}>
                    {genome.id} - {genome.name}
                    {genome.active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-[#3c4f3d]/60">
              {selectedGenome &&
                genomes.find((genome) => genome.id === selectedGenome)
                  ?.sourceName}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
