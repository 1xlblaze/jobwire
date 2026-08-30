import { PROFILE } from "./profile";

export type SuggestJob = {
  title?: string;
  company?: string;
  description?: string;
};

function blob(q: string) {
  return q.trim().toLowerCase();
}

function yearsForSkill(skill: string) {
  const needle = skill.toLowerCase();
  for (const [name, years] of Object.entries(PROFILE.skills)) {
    if (name.toLowerCase() === needle) return years;
    if (needle.includes(name.toLowerCase()) || name.toLowerCase().includes(needle)) {
      return years;
    }
  }
  return null;
}

function namedSkill(question: string) {
  const q = blob(question);
  return (
    Object.keys(PROFILE.skills)
      .sort((a, b) => b.length - a.length)
      .find((skill) => new RegExp(`\\b${skill}\\b`, "i").test(q)) || null
  );
}

export function heuristicAnswer(question: string): string | null {
  const q = blob(question);
  if (!q) return null;
  const skill = namedSkill(question);
  if (skill && /\b(years?|yrs?|experience|exp)\b/.test(q)) {
    const years = yearsForSkill(skill);
    if (years != null) return String(years);
  }
  if (/notice\s*period|how soon|start date|joining|availability/.test(q)) {
    return `${PROFILE.noticePeriodDays} days`;
  }
  if (/current (ctc|salary|comp|pay)|present (ctc|salary)/.test(q)) {
    return `${PROFILE.currentCtcLpa} LPA`;
  }
  if (/expected (ctc|salary|comp|pay)|salary expectation|desired (salary|ctc)/.test(q)) {
    return `${PROFILE.expectedCtcLpa} LPA`;
  }
  if (/\b(phone|mobile|cell)\b/.test(q) && !q.includes("country")) return PROFILE.phone;
  if (q.includes("email")) return PROFILE.email;
  if (/full name|first name|last name|your name/.test(q)) {
    if (q.includes("first")) return PROFILE.firstName;
    if (q.includes("last") || q.includes("surname")) return PROFILE.lastName;
    return PROFILE.fullName;
  }
  if (/where do you live|current location|city|based in/.test(q)) return PROFILE.location;
  if (/total experience|years of experience|how many years/.test(q) && !skill) {
    return String(PROFILE.experienceYears);
  }
  if (/education|degree|qualification|university/.test(q)) return PROFILE.education;
  if (/github/.test(q)) return PROFILE.github;
  if (/linkedin/.test(q)) return PROFILE.linkedin;
  if (/portfolio|personal site|website/.test(q)) return PROFILE.website;
  if (/sponsor|visa|work (auth|permit|authorization)|authorized to work/.test(q)) {
    if (/sponsor/.test(q)) return PROFILE.requiresSponsorship ? "Yes" : "No";
    return PROFILE.workAuthorization;
  }
  if (/relocat/.test(q)) return PROFILE.willingToRelocate ? "Yes" : "No";
  if (/\b(remote|hybrid|onsite|on-site)\b/.test(q) && /prefer|willing|ok with|open to|work from/.test(q)) {
    return PROFILE.remotePreference;
  }
  if (/full[- ]?time|part[- ]?time|contract|employment type/.test(q)) {
    return PROFILE.employmentType;
  }
  return null;
}

function templateAnswer(question: string, job?: SuggestJob) {
  const title = job?.title || "this role";
  const company = job?.company || "your team";
  const skills = Object.keys(PROFILE.skills).slice(0, 6).join(", ");
  return `I am a ${PROFILE.experienceYears}-year Python backend engineer interested in ${title} at ${company}. I have shipped production services with ${skills}. ${PROFILE.summary} Happy to walk through relevant work in a screen.`;
}

export async function solveQuestion(question: string, job?: SuggestJob) {
  const heuristic = heuristicAnswer(question);
  if (heuristic) {
    return { answer: heuristic, source: "heuristic" as const };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are an executive candidate assistant. Answer concisely. If asked for years with a technology, return only an integer. Cover notes under 75 words. Output only the answer text.",
          },
          {
            role: "user",
            content: `RESUME\n${PROFILE.resume}\n\nJOB\n${job?.title || ""} at ${job?.company || ""}\n${job?.description || ""}\n\nQUESTION\n${question}`,
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const answer = String(data.choices?.[0]?.message?.content || "").trim();
      if (answer) return { answer, source: "llm" as const };
    }
  }
  return { answer: templateAnswer(question, job), source: "template" as const };
}
