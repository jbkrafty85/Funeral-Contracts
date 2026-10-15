// Single source for the consent wording. The form, the privacy page and every
// submission's consent_version all read from here, so what a family agreed to is provable.
// Changing any wording below means bumping CONSENT_VERSION. Have counsel review before launch.

export const CONSENT_VERSION = "v1";

export const CONSENT_LABEL =
  "I agree to a free review of my funeral, cemetery or preneed contract. I understand the prices, " +
  "the seller's name and the advice given are kept — never my name or personal details — to improve future reviews.";

export const CONSENT_DETAILS: { heading: string; body: string }[] = [
  {
    heading: "What we do",
    body: "A contract reviewer goes through your funeral, cemetery or preneed contract and sends you the findings at no cost.",
  },
  {
    heading: "What we keep",
    body:
      "Item prices, the funeral home, cemetery or preneed seller's name and city, the month of the contract, and our advice. " +
      "We use this to build tools that help future families review contracts.",
  },
  {
    heading: "What we delete",
    body:
      "Your uploaded contract is deleted once your review is sent. Your email or phone number is deleted 7 days later. " +
      "We never keep names, addresses, birth dates, Social Security numbers, or policy numbers.",
  },
  {
    heading: "What we never share",
    body: "We don't sell your information, and we don't disclose details of your conversations with our representatives.",
  },
];

export const CONSENT_FOOTNOTE = "This review is informational and is not legal or financial advice.";
