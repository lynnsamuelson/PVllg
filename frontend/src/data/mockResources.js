// SAMPLE DATA so the pages have something to show. Replace with an API call
// (see src/api/client.js) once the resources model exists in Django.
export const mockResources = [
  {
    id: "1",
    title: "Getting started guide",
    category: "Guide",
    summary: "An overview of how to use PVllg.",
    description: "Longer description of the getting started guide goes here.",
  },
  {
    id: "2",
    title: "Community calendar",
    category: "Events",
    summary: "Upcoming events and meetups.",
    description: "Longer description of the community calendar goes here.",
  },
  {
    id: "3",
    title: "Help center",
    category: "Support",
    summary: "Answers to common questions.",
    description: "Longer description of the help center goes here.",
  },
  {
    id: "4",
    title: "Local services directory",
    category: "Directory",
    summary: "Find services near you.",
    description: "Longer description of the services directory goes here.",
  },
];

export function getMockResource(id) {
  return mockResources.find((r) => r.id === id);
}
