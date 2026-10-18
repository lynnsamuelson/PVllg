// Every URL in the app lives here, so links never hard-code paths.
export const ROUTES = {
  home: "/",
  welcome: "/welcome",
  accountType: "/signup/type",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  profile: "/profile",
  profileSetup: "/profile/setup",
  orgSignup: "/org/signup",
  orgVerify: "/org/verify",
  orgProfile: "/org/profile",
  orgItems: "/org/items",
  postItem: "/items/new",
  editItem: (id = ":itemId") => `/items/${id}/edit`,
  item: (id = ":itemId") => `/items/${id}`,
  search: "/search",
  claims: "/claims",
  claimCalendar: (id = ":claimId") => `/claims/${id}/calendar`,
  claimReport: (id = ":claimId") => `/claims/${id}/report`,
  give: "/give",
  impact: "/impact",
  resource: (id = ":resourceId") => `/resources/${id}`,
  status: "/status",
};

// The first tab a signed-in account lands on.
export const homeFor = (user) => (user?.account_type === "organization" ? ROUTES.orgItems : ROUTES.home);
