import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireUserPage } from "@/lib/auth";
import { homePathFor } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";

export default async function ForbiddenPage() {
  const user = await requireUserPage();
  return (
    <Card className="mx-auto mt-10 max-w-md">
      <EmptyState
        icon={<ShieldAlert />}
        title="You don't have access to this page"
        description="Your role doesn't include this module. Ask an admin if you need access."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={homePathFor(user)}>Go to my home</Link>
          </Button>
        }
      />
    </Card>
  );
}
