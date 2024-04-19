import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authStore } from "@/stores/authStore";
import { useStore } from "@nanostores/react";
import {
  getAuth,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { useCallback, useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./ui/input-otp";

export default function RegisterForm() {
  const { isLoading, recaptchaVerifier } = useStore(authStore);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult>();

  const onSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      if (!recaptchaVerifier) return;
      const formData = new FormData(event.currentTarget);
      event.preventDefault();
      authStore.setKey("isLoading", true);
      // Remove 0 from starting
      const result = await signInWithPhoneNumber(
        getAuth(),
        `+971${formData.get("mobile")?.toString().replace(/^0/, "")}`,
        recaptchaVerifier
      );
      setConfirmationResult(result);
      authStore.setKey("isLoading", false);
    },
    [recaptchaVerifier]
  );

  const onVerify: React.FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const otp = formData.get("otp")?.toString();
      if (!confirmationResult || !otp) return;
      const result = await confirmationResult.confirm(otp);
      authStore.setKey("isLoading", false);
      location.pathname = "/profile";
    },
    [confirmationResult]
  );
  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-4 h-full">
        <div className="grid gap-2 mb-auto">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            type="mobile"
            name="mobile"
            placeholder="052XXXXXXX"
            minLength={9}
            maxLength={10}
            required
          />
          <p className="text-xs text-foreground/30">
            Only UAE numbers are supported at the moment
          </p>
        </div>
        {!confirmationResult && (
          <Button
            disabled={!recaptchaVerifier || isLoading}
            type="submit"
            className="w-full">
            Get OTP
          </Button>
        )}
      </form>
      {confirmationResult && (
        <form onSubmit={onVerify} className="grid gap-4 mt-8">
          <p className="text-sm">Please enter the OTP sent to your phone</p>
          <InputOTP name="otp" maxLength={6}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <Button disabled={isLoading} type="submit" className="w-full">
            Verify
          </Button>
        </form>
      )}
    </>
  );
}
