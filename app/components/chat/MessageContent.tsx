import React from 'react';

interface AccountDetail {
  label: string;
  value: string;
}

interface Transaction {
  date: string;
  details: string;
}

interface Reference {
  contentPreview: string;
  source: string;
  score: number;
  category: string;
}

export type FormattedSection = 
  | { type: 'accountOverview'; content: AccountDetail[] }
  | { type: 'transactions'; content: Transaction[] }
  | { type: 'spendingHabits'; content: string }
  | { type: 'additionalInfo'; content: string }
  | { type: 'recommendations'; content: string[] }
  | { type: 'disclaimer'; content: string }
  | { type: 'text'; content: string }
  | { type: 'references'; content: Reference[] };

const AccountOverview: React.FC<{ details: AccountDetail[] }> = ({ details }) => (
  <div className="bg-gray-800 rounded-lg p-4 mb-4">
    <h3 className="text-lg font-semibold text-blue-400 mb-2">Account Overview</h3>
    <div className="grid grid-cols-2 gap-2">
      {details.map((detail, index) => (
        <div key={index} className="col-span-1">
          <span className="text-gray-400">{detail.label}:</span>
          <span className="text-white ml-2">{detail.value}</span>
        </div>
      ))}
    </div>
  </div>
);

const TransactionList: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => (
  <div className="bg-gray-800 rounded-lg p-4 mb-4">
    <h3 className="text-lg font-semibold text-blue-400 mb-2">Recent Transactions</h3>
    <div className="space-y-2">
      {transactions.map((transaction, index) => (
        <div key={index} className="border-b border-gray-700 pb-2">
          <div className="text-gray-300 font-medium">{transaction.date}</div>
          <div className="text-white">{transaction.details}</div>
        </div>
      ))}
    </div>
  </div>
);

const SpendingHabits: React.FC<{ content: string }> = ({ content }) => (
  <div className="bg-gray-800 rounded-lg p-4 mb-4">
    <h3 className="text-lg font-semibold text-blue-400 mb-2">Spending Habits</h3>
    <p className="text-white">{content}</p>
  </div>
);

const AdditionalInfo: React.FC<{ content: string }> = ({ content }) => (
  <div className="bg-gray-800 rounded-lg p-4 mb-4">
    <h3 className="text-lg font-semibold text-blue-400 mb-2">Additional Information</h3>
    <p className="text-white">{content}</p>
  </div>
);

const Recommendations: React.FC<{ recommendations: string[] }> = ({ recommendations }) => (
  <div className="bg-gray-800 rounded-lg p-4 mb-4">
    <h3 className="text-lg font-semibold text-blue-400 mb-2">Recommendations</h3>
    <ul className="list-disc list-inside space-y-2">
      {recommendations.map((recommendation, index) => (
        <li key={index} className="text-white">{recommendation}</li>
      ))}
    </ul>
  </div>
);

const Disclaimer: React.FC<{ content: string }> = ({ content }) => (
  <div className="bg-gray-700 rounded-lg p-4 mb-4">
    <h3 className="text-sm font-medium text-gray-400 mb-1">Disclaimer</h3>
    <p className="text-gray-300 text-sm">{content}</p>
  </div>
);

const TextContent: React.FC<{ content: string }> = ({ content }) => (
  <div className="text-white mb-4">
    {content}
  </div>
);

const References: React.FC<{ references: Reference[] }> = ({ references }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 mb-4 mt-2">
    <h3 className="text-sm font-semibold text-blue-400 mb-2">Reference Documents</h3>
    <div className="space-y-3">
      {references.map((ref, index) => (
        <div key={index} className="border-l-2 border-blue-500/30 pl-3">
          <div className="text-gray-300 text-sm font-medium mb-1">
            {ref.source} ({Math.round(ref.score * 100)}% relevance)
          </div>
          <div className="text-gray-400 text-sm">{ref.contentPreview}</div>
          <div className="text-gray-500 text-xs mt-1">Category: {ref.category}</div>
        </div>
      ))}
    </div>
  </div>
);

export const MessageContent: React.FC<{ content: FormattedSection[] }> = ({ content }) => {
  return (
    <div className="space-y-4">
      {content.map((section, index) => {
        switch (section.type) {
          case 'accountOverview':
            return <AccountOverview key={index} details={section.content} />;
          case 'transactions':
            return <TransactionList key={index} transactions={section.content} />;
          case 'spendingHabits':
            return <SpendingHabits key={index} content={section.content} />;
          case 'additionalInfo':
            return <AdditionalInfo key={index} content={section.content} />;
          case 'recommendations':
            return <Recommendations key={index} recommendations={section.content} />;
          case 'disclaimer':
            return <Disclaimer key={index} content={section.content} />;
          case 'text':
            return <TextContent key={index} content={section.content} />;
          case 'references':
            return <References key={index} references={section.content} />;
          default:
            return null;
        }
      })}
    </div>
  );
}; 