"use client";
import {
  fetchGeneDetails,
  fetchGeneSequence as apiFetchGeneSequence,
  type GeneBounds,
  type GeneDetailsFromSearch,
  type GeneFromSearch,
} from "~/utils/genome-api";
import { Button } from "~/components/ui/button";
import { ArrowLeftCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GeneInformation } from "./gene-info";

export default function GeneViewer({
  gene,
  genomeId,
  onClose,
}: {
  gene: GeneFromSearch;
  genomeId: string;
  onClose: () => void;
}) {
  const [geneDetails, setGeneDetails] = useState<GeneDetailsFromSearch | null>(
    null,
  );
  const [geneBound, setGeneBound] = useState<GeneBounds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startPosition, setStartPosition] = useState<string>("");
  const [endPosition, setEndPosition] = useState<string>("");
  const [geneSequence, setGeneSequence] = useState<string>("");
  const [isSequenceLoading, setIsSequenceLoading] = useState<boolean>(false);
  const [actualRange, setActualRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const fetchGeneSequence = useCallback(
    async (start: number, end: number) => {
      try {
        setIsSequenceLoading(true);
        setError(null);
        const {
          sequence,
          actualRange: fetchedRange,
          error: apiError,
        } = await apiFetchGeneSequence(gene.chromosome, start, end, genomeId);

        setGeneSequence(sequence);
        setActualRange(fetchedRange);
        if (apiError) {
          setError(apiError);
        }
      } catch (err) {
        setIsSequenceLoading(false);
      }
    },
    [gene.chromosome, genomeId],
  );

  useEffect(() => {
    const initializeGeneData = async () => {
      setIsLoading(true);
      setError(null);
      setGeneDetails(null);
      setStartPosition("");
      setEndPosition("");

      if (!gene.gene_id) {
        setError("Gene ID is missing ,cannot fetch gene details");
        setIsLoading(false);
        return;
      }
      try {
        const {
          geneDetails: fetchedDetails,
          geneBounds: fetchGeneBounds,
          initialRange: fetchedRange,
        } = await fetchGeneDetails(gene.gene_id);

        setGeneDetails(fetchedDetails);
        setGeneBound(fetchGeneBounds);

        if (fetchedRange) {
          setStartPosition(fetchedRange.start.toString());
          setEndPosition(fetchedRange.end.toString());
          await fetchGeneSequence(fetchedRange.start, fetchedRange.end);
        }
      } catch (error) {
        setError("Failed to load gene details.Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeGeneData();
  }, [gene, genomeId]);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size={"sm"}
        className="cusror-pointer text-[#3c4f3d] hover:bg-[#e9eeea]/70"
        onClick={onClose}
      >
        <ArrowLeftCircle className="mr-2 h-4 w-4" />
        Back to Results
      </Button>
      <GeneInformation
        gene={gene}
        geneBounds={geneBound}
        geneDetail={geneDetails}
      />
    </div>
  );
}
