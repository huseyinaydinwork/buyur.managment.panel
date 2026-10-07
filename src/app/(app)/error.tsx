"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-md">
      <EmptyState
        icon={<AlertTriangle />}
        title="Something went wrong loading this page"
        description={error.digest ? `Reference: ${error.digest}` : "Please try again. If it keeps happening, tell an admin."}
        action={
          <Button size="sm" variant="outline" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Card>
  );
}
