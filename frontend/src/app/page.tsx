"use client";
import { useEffect } from "react";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { getAcailableGenomes } from "~/utils/genome-api";

export default function HomePage() {
  useEffect(() => {
    const fetchGenomes = async () => {
      const data = await getAcailableGenomes();
      console.log(data)
    };
    fetchGenomes();
  }, []);

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
        </Card>
      </main>
    </div>
  );
}
