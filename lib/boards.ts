export type BoardId = "linkedin" | "naukri";

export const SEARCH_KEYWORDS = ["Senior Python Developer", "Backend Engineer"];

export function linkedinSearchUrl(keyword: string, location = "Bengaluru") {
  const params = new URLSearchParams({
    keywords: keyword,
    location,
    f_TPR: "r86400",
    f_AL: "true",
  });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export function naukriSearchUrl(keyword: string, location = "bangalore") {
  const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://www.naukri.com/${slug}-jobs-in-${location}?jobAge=1`;
}

export const BOARD_SEARCHES: { id: BoardId; label: string; href: string; blurb: string }[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    href: linkedinSearchUrl(SEARCH_KEYWORDS[0]),
    blurb: "Apify guest search, past 24 hours, Bangalore. You apply in LinkedIn; Jobwire only drafts answers.",
  },
  {
    id: "naukri",
    label: "Naukri",
    href: naukriSearchUrl("python-developer"),
    blurb: "Apify Naukri search in Bangalore posted today. You apply on Naukri; Jobwire only drafts answers.",
  },
];
