export const DOCUMENT_TYPE_MAP = {
  identity: 'proof-of-identity',
  address: 'proof-of-address',
  bank_statement: 'bank-statements',
  proof_of_funds: 'proof-of-funds',
  property_valuation: 'property-valuation',
  builder_quote: 'builder-quotes',
} as const;


export const REQUIRED_DOCUMENTS = Object.keys(
  DOCUMENT_TYPE_MAP,
) as Array<keyof typeof DOCUMENT_TYPE_MAP>;
