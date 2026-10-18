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
  postItem: "/org/items/new",
  search: "/search",
  claims: "/claims",
  give: "/give",
  impact: "/impact",
  resource: (id = ":resourceId") => `/resources/${id}`,
  status: "/status",
};

// The first tab a signed-in account lands on.
export const homeFor = (user) => (user?.account_type === "organization" ? ROUTES.orgItems : ROUTES.home);
