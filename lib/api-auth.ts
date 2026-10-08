import { apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: apiError(401, "UNAUTHORIZED", "Sign in to access this resource.") };
  }
  return { user, response: null };
}
