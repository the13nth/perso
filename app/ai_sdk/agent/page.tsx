"use client";

import React, { useEffect, useRef, useState } from "react";
import { readStreamableValue } from "ai/rsc";
import { runAgent } from "./action";
import { StreamEvent } from "@langchain/core/tracers/log_stream";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<StreamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;

    try {
      setIsLoading(true);
      setData([]);
      setInput("");

      const { streamData } = await runAgent(input);
      for await (const item of readStreamableValue(streamData)) {
        setData((prev) => [...prev, item]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-12 flex flex-col stretch gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
        />
        <Button type="submit" disabled={isLoading}>
          Submit
        </Button>
      </form>
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 px-2 h-[650px] overflow-y-auto"
      >
        {data.map((item, i) => (
          <div key={i} className="p-4 bg-[#25252f] rounded-lg">
            <strong>Event:</strong> <p className="text-sm">{item.event}</p>
            <br />
            <strong>Data:</strong>{" "}
            <p className="break-all text-sm">
              {JSON.stringify(item.data, null, 2)}
            </p>
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <div className="flex flex-col w-full gap-2">
          <strong className="text-center">Question</strong>
          <p className="break-words">{data[0].data.input.input}</p>
        </div>
      )}

      {!isLoading && data.length > 1 && (
        <>
          <hr />
          <div className="flex flex-col w-full gap-2">
            <strong className="text-center">Result</strong>
            <p className="break-words">{data[data.length - 1].data.output}</p>
          </div>
        </>
      )}
    </div>
  );
}
