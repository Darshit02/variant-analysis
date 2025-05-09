"use client";
import {
  fetchGeneDetails,
  fetchGeneSequence as apiFetchGeneSequence,
  fetchClinVariants as apiFetchClinVariants,
  type GeneBounds,
  type GeneDetailsFromSearch,
  type GeneFromSearch,
  type ClinvarVariant,
} from "~/utils/genome-api";
import { Button } from "~/components/ui/button";
import { ArrowLeftCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GeneInformation } from "./gene-info";
import { GeneSequence } from "./gene-sequance";
import KnownVariants from "./known-variants";

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
  const [clinvarVariants, setClinvarVariants] = useState<ClinvarVariant[]>([]);
  const [isClinvarLoading, setIsClinvarLoading] = useState<boolean>(false);
  const [isClinvarError, setIsClinvarError] = useState<string | null>(null);
  const [actualRange, setActualRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [activeSequencePosition, setActiveSequencePosition] = useState<
    number | null
  >(null);
  const [activeReferenceNucleotide, setActiveReferenceNucleotide] = useState<
    string | null
  >(null);
  const [comparisonVariant, setComparisonVariant] =
    useState<ClinvarVariant | null>(null);

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
      } finally {
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

  const handleLoadSequence = useCallback(() => {
    const start = parseInt(startPosition);
    const end = parseInt(endPosition);
    let validationError: string | null = null;

    if (isNaN(start) || isNaN(end)) {
      validationError = "Please enter valid start and end positions";
    } else if (start >= end) {
      validationError = "Start position must be less than end position";
    } else if (geneBound) {
      const minBound = Math.min(geneBound.min, geneBound.max);
      const maxBound = Math.max(geneBound.min, geneBound.max);
      if (start < minBound) {
        validationError = `Start position (${start.toLocaleString()}) is below the minimum value (${minBound.toLocaleString()})`;
      } else if (end > maxBound) {
        validationError = `End position (${end.toLocaleString()}) exceeds the maximum value (${maxBound.toLocaleString()})`;
      }

      if (end - start > 10000) {
        validationError = `Selected range exceeds maximum view range of 10.000 bp.`;
      }
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    fetchGeneSequence(start, end);
  }, [startPosition, endPosition, fetchGeneSequence, geneBound]);

  const fetchClinvarVariants = async () => {
    if (!gene.chromosome || !geneBound) return;

    setIsClinvarLoading(true);
    setIsClinvarError(null);

    try {
      const variants = await apiFetchClinVariants(
        gene.chromosome,
        geneBound,
        genomeId,
      );
      setClinvarVariants(variants);
      console.log(variants);
    } catch (error) {
      setIsClinvarError("Failed to fetch ClinVar variants");
      setClinvarVariants([]);
    } finally {
      setIsClinvarLoading(false);
    }
  };

  const updateClinvarVariant = (
    clinvar_id: string,
    updateVariant: ClinvarVariant,
  ) => {
    setClinvarVariants((currentVariants) =>
      currentVariants.map((v) =>
        v.clinvar_id == clinvar_id ? updateVariant : v,
      ),
    );
  };

  useEffect(() => {
    if (geneBound) {
      fetchClinvarVariants();
    }
  }, [geneBound]);

  // const showComparison = (variant: ClinvarVariant) => {
  //   if (variant.evo2Result) {
  //     setComparisonVariant(variant);
  //   }
  // };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800"></div>
      </div>
    );
  }

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

      <KnownVariants
        refreshVariants={fetchClinvarVariants}
        showComparison={() => {}}
        updateClinvarVariant={updateClinvarVariant}
        clinvarVariants={clinvarVariants}
        isLoadingClinvar={isClinvarLoading}
        clinvarError={isClinvarError}
        genomeId={genomeId}
        gene={gene}
      />

      <GeneSequence
        geneBounds={geneBound}
        geneDetail={geneDetails}
        startPosition={startPosition}
        endPosition={endPosition}
        onStartPositionChange={setStartPosition}
        onEndPositionChange={setEndPosition}
        sequenceData={geneSequence}
        sequenceRange={actualRange}
        isLoading={isSequenceLoading}
        error={error}
        onSequenceLoadRequest={handleLoadSequence}
        onSequenceClick={() => {}}
        maxViewRange={10000}
      />

      <GeneInformation
        gene={gene}
        geneBounds={geneBound}
        geneDetail={geneDetails}
      />
    </div>
  );
}
