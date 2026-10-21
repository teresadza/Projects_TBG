import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppFooter } from "@/components/AppFooter";

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <span className="text-lg font-bold tracking-tight">Portfolio Tools</span>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">← Back to app</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">About</h1>
          <Badge variant="secondary">Prototype</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What this is</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              This is an experimental portfolio analytics sandbox I've been playing
              around with. It's not a production tool and it's not a replacement for
              your custodian — think of it as a decision-support layer for asking
              "what if?" questions.
            </p>
            <p>The app has three screens:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <span className="font-medium text-foreground">Portfolio Monitoring</span> —
                track a portfolio's performance in NZD, with FX impact made explicit.
              </li>
              <li>
                <span className="font-medium text-foreground">Asset Exploration</span> —
                compare assets, benchmarks, and portfolios in local currency or NZD.
              </li>
              <li>
                <span className="font-medium text-foreground">Portfolio Construction</span> —
                load actual weights as a baseline and tweak them to simulate
                alternative allocations.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who I am</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              I'm Teresa, founder of Blupoint Analytics. I'm exploring how lightweight
              tools can make portfolio analysis and governance clearer for
              NZ-based investors. This prototype is me thinking out loud in code.
            </p>
            <p>
              Feedback, ideas, or just curious? Get in touch at{" "}
              <a
                href="mailto:teresa@blupointanalytics.co.nz"
                className="text-foreground underline underline-offset-4 hover:no-underline"
              >
                teresa@blupointanalytics.co.nz
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Data, calculations, and UI are all work-in-progress. Numbers shown
              here are for exploration only — don't make investment decisions based
              on this prototype.
            </p>
          </CardContent>
        </Card>
      </main>

      <AppFooter />
    </div>
  );
}
