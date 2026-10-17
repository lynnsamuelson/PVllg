// Every URL in the app lives here, so links never hard-code paths.
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  profile: "/profile",
  resource: (id = ":resourceId") => `/resources/${id}`,
  status: "/status",
};
