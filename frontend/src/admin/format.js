// Small display helpers shared by the admin cards.
export const displayName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ');

// A company name when there is one, otherwise the person's own name.
export const partyName = (person) => person?.companyName || displayName(person);
