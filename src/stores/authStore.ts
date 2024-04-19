import { map } from "nanostores";
import { RecaptchaVerifier } from "firebase/auth";

export interface AuthStore {
  recaptchaVerifier: RecaptchaVerifier | null;
  isLoading: boolean;
}

export const authStore = map<AuthStore>({
  recaptchaVerifier: null,
  isLoading: false,
});
