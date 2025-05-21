import React from "react";

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: string | number | boolean;
  };
}

interface Props {
  embeddings: Embedding[];
}

function vectorNorm(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
}

function getMostCommonWords(texts: string[], topN = 5): [string, number][] {
  const wordCounts: Record<string, number> = {};
  texts.forEach(text => {
    text.toLowerCase().split(/\W+/).forEach(word => {
      if (word.length > 2) wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

const EmbeddingAnalysis: React.FC<Props> = ({ embeddings }) => {
  if (!embeddings.length) return null;

  const norms = embeddings.map(e => vectorNorm(e.vector));
  const minNorm = Math.min(...norms).toFixed(2);
  const maxNorm = Math.max(...norms).toFixed(2);
  const meanNorm = (norms.reduce((a, b) => a + b, 0) / norms.length).toFixed(2);

  const texts = embeddings.map(e => (typeof e.metadata.text === 'string' ? e.metadata.text : ''));
  const commonWords = getMostCommonWords(texts);

  return (
    <div>
      <div className="mb-2">
        <span className="font-medium">Vector Norms:</span> Min: {minNorm}, Max: {maxNorm}, Mean: {meanNorm}
      </div>
      <div>
        <span className="font-medium">Most Common Words:</span>
        <ul className="list-disc list-inside">
          {commonWords.map(([word, count]) => (
            <li key={word}>
              {word} <span className="text-xs text-muted-foreground">({count})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EmbeddingAnalysis; 