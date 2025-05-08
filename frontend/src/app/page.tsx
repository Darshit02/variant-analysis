"use client";
import { Search, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import GeneViewer from "~/components/gene-viewer";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  getAvailableGenomes,
  getGenomeChromosomes,
  searchGenes,
  type ChromosomeFromSearch,
  type GeneFromSearch,
  type GenomeAssemblyFromSearch,
} from "~/utils/genome-api";

type Mode = "search" | "browse";

export default function HomePage() {
  const [genomes, setGenomes] = useState<GenomeAssemblyFromSearch[]>([]);
  const [chromosomes, setChromosomes] = useState<ChromosomeFromSearch[]>([]);
  const [selectedChromosome, setSelectedChromosome] = useState<string>("chr1");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGenome, setSelectedGenome] = useState<string>("hg38");
  const [selectedGene, setSelectedGene] = useState<GeneFromSearch | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [searchResults, setSearchResults] = useState<GeneFromSearch[]>([]);

  useEffect(() => {
    const fetchGenomes = async () => {
      try {
        setIsLoading(true);
        const data = await getAvailableGenomes();
        if (data.genomes && data.genomes["Human"]) {
          setGenomes(data.genomes["Human"]);
        }
      } catch (err) {
        setError("Failed to load genome data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGenomes();
  }, []);

  useEffect(() => {
    const fetchChromosomes = async () => {
      try {
        setIsLoading(true);
        const data = await getGenomeChromosomes(selectedGenome);
        setChromosomes(data.chromosomes);        if (data.chromosomes.length > 0) {
          setSelectedChromosome(data.chromosomes[0]!.name);
        }
      } catch (err) {
        setError("Failed to load chromosome data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchChromosomes();
  }, [selectedGenome]);

  const performGeneSearch = async (
    query: string,
    genome: string,
    filterFn?: (gene: GeneFromSearch) => boolean,
  ) => {
    try {
      setIsLoading(true);
      const data = await searchGenes(query, genome);
      const results = filterFn ? data.results.filter(filterFn) : data.results;

      setSearchResults(results);
    } catch (err) {
      setError("Faield to search genes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedChromosome || mode !== "browse") return;
    performGeneSearch(
      selectedChromosome,
      selectedGenome,
      (gene: GeneFromSearch) => gene.chromosome === selectedChromosome,
    );
  }, [selectedChromosome, selectedGenome, mode]);

  const handleGenomeChange = (value: string) => {
    setSelectedGenome(value);
    setSearchResults([]);
    setSelectedGene(null);
  };

  const switchMode = (newMode: Mode) => {
    if (newMode === mode) return;

    setSearchResults([]);
    setSelectedGene(null);
    setError(null);

    if (newMode === "browse" && selectedChromosome) {
      performGeneSearch(
        selectedChromosome,
        selectedGenome,
        (gene: GeneFromSearch) => gene.chromosome === selectedChromosome,
      );
    }

    setMode(newMode);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    performGeneSearch(searchQuery, selectedGenome);
  };

  const loadBRCA1Example = () => {
    setMode("search");
    setSearchQuery("BRCA1");
    performGeneSearch("BRCA1", selectedGenome);
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
        {selectedGene ? (
          <>
            <GeneViewer
            gene={selectedGene}
            genomeId={selectedGenome}
            onClose={() => setSelectedGene(null)}
            />
          </>
        ) : (
          <>
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
            <Card className="mt-6 gap-0 border-none bg-white py-0 shadow-sm">
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-sm font-normal text-[#3c4f3d]/70">
                  Browse
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <Tabs
                  value={mode}
                  onValueChange={(value) => switchMode(value as Mode)}
                >
                  <TabsList className="mb-4 bg-[#e9eeea]">
                    <TabsTrigger
                      value="search"
                      className="data-[state=active]:bg-white data-[state=active]:text-[#3c4f3d]"
                    >
                      Search Geans
                    </TabsTrigger>
                    <TabsTrigger
                      value="browse"
                      className="data-[state=active]:bg-white data-[state=active]:text-[#3c4f3d]"
                    >
                      Browse Chromosomes
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="search" className="mt-0">
                    <div className="space-y-4">
                      <form
                        action=""
                        onSubmit={handleSearch}
                        className="flex flex-col gap-3 sm:flex-row"
                      >
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            placeholder="Enter Gene symbol or name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 border-[#3c4f3d]/10 pr-20" // extra padding on right
                          />

                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="absolute top-0 right-10 flex h-9 w-9 items-center justify-center text-gray-500 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}

                          <Button
                            type="submit"
                            size="icon"
                            className="absolute top-0 right-0 h-full cursor-pointer rounded-l-none bg-[#3c4f3d] text-white hover:bg-[#3c4f3d]/90"
                            disabled={isLoading || !searchQuery.trim()}
                          >
                            <Search className="h-4 w-4" />
                            <span className="sr-only">Search</span>
                          </Button>
                        </div>
                      </form>
                      <Button
                        variant="link"
                        onClick={loadBRCA1Example}
                        className="h-auto cursor-pointer p-0 text-[#de8246] hover:text-[#de8246]/80"
                      >
                        Try BRCA1 example
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="browse" className="mt-0">
                    <div className="max-h-[150px] overflow-y-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        {chromosomes.map((chrom) => (
                          <Button
                            key={chrom.name}
                            variant="outline"
                            size="sm"
                            className={`h-8 cursor-pointer border-[#3c4f3d]/10 hover:bg-[#e9eeea] hover:text-[#3c4f3d] ${selectedChromosome === chrom.name ? "border border-[#de8246] bg-[#e9eeea] text-[#3c4f3d]" : ""}`}
                            onClick={() => setSelectedChromosome(chrom.name)}
                          >
                            {chrom.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                {isLoading && (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3c4f3d]/30 border-t-[#de8243]"></div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {searchResults.length > 0 && !isLoading && (
                  <div className="mt-6">
                    <div className="mb-2">
                      <h4 className="text-xs font-normal text-[#3c4f3d]/70">
                        {mode === "search" ? (
                          <>
                            Search Results:{" "}
                            <span className="font-medium text-[#3c4f3d]">
                              {searchResults.length} genes
                            </span>
                          </>
                        ) : (
                          <>
                            Genes on {selectedChromosome}:{" "}
                            <span className="font-medium text-[#3c4f3d]">
                              {searchResults.length} found
                            </span>
                          </>
                        )}
                      </h4>
                    </div>

                    <div className="overflow-hidden rounded-md border border-[#3c4f3d]/5">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#e9eeea]/50 hover:bg-[e9eeea]/70">
                            <TableHead className="text-xs font-normal text-[#3c4f3d]/70">
                              Symbol
                            </TableHead>
                            <TableHead className="text-xs font-normal text-[#3c4f3d]/70">
                              Name
                            </TableHead>
                            <TableHead className="text-xs font-normal text-[#3c4f3d]/70">
                              Location
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((gene, index) => (
                            <TableRow
                              key={`${gene.symbol}-${index}`}
                              className="cursor-pointer border-b border-[#3c4f3d]/5 hover:bg-[#e9eeea]/50"
                              onClick={() => setSelectedGene(gene)}
                            >
                              <TableCell className="py-2 font-medium text-[#3c4f3d]">
                                {gene.symbol}
                              </TableCell>
                              <TableCell className="py-2 font-medium text-[#3c4f3d]">
                                {gene.name}
                              </TableCell>
                              <TableCell className="py-2 font-medium text-[#3c4f3d]">
                                {gene.chromosome}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {!isLoading && !error && searchResults.length === 0 && (
                  <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-400 py-4 text-center text-gray-400">
                    <Search className="mb-4 h-10 w-10 text-gray-400" />

                    <p className="text-sm leading-relaxed">
                      {mode === "search"
                        ? "Enter a gene or symbol click search"
                        : selectedChromosome
                          ? "No genes found on this chromosome"
                          : "Select a chromosome to browse"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
