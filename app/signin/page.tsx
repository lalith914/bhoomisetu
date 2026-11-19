
import { Suspense } from "react";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="signin-page">
          <div className="signin-content">
            <p>Loading secure access...</p>
          </div>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
