import { getAllDependencies, normalizeText, sanitizeFrameworkName, unique } from "./utils.js";
import type { PackageJson } from "./types.js";

const knownRules: Array<{ stack: string; keywords: string[]; dependencies: string[] }> = [
  {
    stack: "nextjs",
    keywords: ["next", "server actions", "app router", "next.js", "nextjs"],
    dependencies: ["next"]
  },
  {
    stack: "react",
    keywords: ["react", "hooks", "jsx", "useeffect", "usestate", "usememo", "useref", "usecontext", "usecallback"],
    dependencies: ["react", "react-dom"]
  },
  {
    stack: "vue",
    keywords: ["vue", "vuex", "pinia", "nuxt", "composition api", "options api", "vue router"],
    dependencies: ["vue", "nuxt", "pinia", "@vue/core"]
  },
  {
    stack: "svelte",
    keywords: ["svelte", "sveltekit", "svelte store", "svelte component"],
    dependencies: ["svelte", "@sveltejs/kit"]
  },
  {
    stack: "angular",
    keywords: ["angular", "rxjs", "ngrx", "angular cli", "ngmodule", "ngfor", "ngif", "injectable"],
    dependencies: ["@angular/core", "@angular/common"]
  },
  {
    stack: "django",
    keywords: ["django", "drf", "djangorestframework", "django orm", "django view", "django model"],
    dependencies: ["django", "djangorestframework"]
  },
  {
    stack: "flask",
    keywords: ["flask", "flask route", "flask blueprint", "flask sqlalchemy", "werkzeug"],
    dependencies: ["flask"]
  },
  {
    stack: "fastapi",
    keywords: ["fastapi", "pydantic", "starlette", "uvicorn", "fastapi route"],
    dependencies: ["fastapi"]
  },
  {
    stack: "express",
    keywords: ["express", "expressjs", "express router", "express middleware"],
    dependencies: ["express"]
  },
  {
    stack: "go",
    keywords: [
      "golang", "goroutine", "go modules", "go test", "go mod", "go build",
      "net/http", "net/url", "net/rpc", "fmt.", "os.open", "io.reader", "bufio",
      "gorilla", "servemux", "handlefunc", "http.handle", "http.serve",
      "go routing", "go http", "chi router", "gin framework", "echo framework",
      "go context", "go channel", "go interface", "go struct", "go defer"
    ],
    dependencies: []
  },
  {
    stack: "rust",
    keywords: [
      "rust", "cargo", "tokio", "actix", "axum", "wasm",
      "ownership", "borrow checker", "lifetime", "trait impl",
      "rust async", "rust closure", "rust enum", "rust match", "rust iterator",
      "crate", "mod ", "use std", "fn main", "impl ", "pub fn"
    ],
    dependencies: []
  },
  {
    stack: "python",
    keywords: [
      "python", "pip", "asyncio", "pytest", "dataclass",
      "def ", "import os", "import sys", "from typing", "__init__",
      "list comprehension", "decorator", "context manager", "generator"
    ],
    dependencies: []
  },
  {
    stack: "ruby",
    keywords: ["ruby", "rails", "sinatra", "rake", "bundler", "activerecord", "rspec", "gem "],
    dependencies: []
  },
  {
    stack: "php",
    keywords: ["php", "laravel", "symfony", "composer", "artisan", "eloquent", "blade template"],
    dependencies: []
  },
  {
    stack: "java",
    keywords: [
      "java", "spring", "maven", "gradle", "junit", "hibernate",
      "springboot", "spring mvc", "java stream", "java generics", "java annotation"
    ],
    dependencies: []
  },
  {
    stack: "kotlin",
    keywords: ["kotlin", "coroutines", "ktor", "jetpack compose", "android kotlin", "kotlin flow", "kotlin sealed"],
    dependencies: []
  },
  {
    stack: "swift",
    keywords: ["swift", "swiftui", "xcode", "ios", "combine", "swift async", "swift actor", "swift protocol"],
    dependencies: []
  },
  {
    stack: "csharp",
    keywords: ["c#", "csharp", ".net", "dotnet", "asp.net", "entity framework", "linq", "nuget", "blazor"],
    dependencies: []
  },
  {
    stack: "postgres",
    keywords: ["postgres", "postgresql", "pg", "psql", "plpgsql", "pg_", "postgres index", "postgres query"],
    dependencies: ["pg", "postgres", "pgpool"]
  },
  {
    stack: "mysql",
    keywords: ["mysql", "mariadb", "innodb", "mysql query", "mysql index"],
    dependencies: ["mysql", "mysql2"]
  },
  {
    stack: "redis",
    keywords: ["redis", "redis cache", "redis pubsub", "redis stream", "redis lua"],
    dependencies: ["redis", "ioredis", "@upstash/redis"]
  },
  {
    stack: "mongodb",
    keywords: ["mongodb", "mongoose", "atlas", "bson", "aggregation pipeline", "mongodb query"],
    dependencies: ["mongodb", "mongoose"]
  },
  {
    stack: "docker",
    keywords: ["docker", "dockerfile", "docker compose", "docker build", "container image", "docker layer"],
    dependencies: []
  },
  {
    stack: "kubernetes",
    keywords: ["kubernetes", "kubectl", "helm", "pod", "deployment yaml", "ingress", "configmap", "secret k8s"],
    dependencies: []
  },
  {
    stack: "terraform",
    keywords: ["terraform", "hcl", "tfstate", "provider block", "resource block", "terraform plan"],
    dependencies: []
  },
  {
    stack: "graphql",
    keywords: ["graphql", "gql", "resolver", "schema definition", "apollo", "graphql query", "graphql mutation"],
    dependencies: ["graphql", "@apollo/server", "@apollo/client"]
  },
  {
    stack: "grpc",
    keywords: ["grpc", "protobuf", "protocol buffer", ".proto", "grpc service", "grpc stream"],
    dependencies: []
  }
];

function genericQueryCandidates(query: string): string[] {
  const normalized = query.toLowerCase();
  const inlineCode = [...query.matchAll(/`([^`]+)`/g)].map((match) => sanitizeFrameworkName(match[1] ?? ""));
  const packageLikeTokens = normalized.match(/[@a-z0-9][@a-z0-9/_-]{1,40}/g) ?? [];

  const stopWords = new Set([
    "how",
    "what",
    "when",
    "where",
    "why",
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "using",
    "use",
    "docs",
    "documentation",
    "official",
    "reference",
    "guide",
    "error",
    "build",
    "api",
    "version",
    "latest",
    "code",
    "node",
    "typescript",
    "javascript"
  ]);

  return unique(
    [...inlineCode, ...packageLikeTokens]
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !stopWords.has(token))
  );
}

export function detectStack(query: string, packageJson?: PackageJson): string[] {
  const normalizedQuery = normalizeText(query.toLowerCase());
  const dependencyMap = getAllDependencies(packageJson);
  const dependencyNames = Object.keys(dependencyMap).map((name) => name.toLowerCase());
  const scored = new Map<string, number>();

  for (const rule of knownRules) {
    let score = 0;

    for (const keyword of rule.keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 3;
      }
    }

    for (const dep of rule.dependencies) {
      if (dependencyNames.includes(dep)) {
        score += 6;
      }
    }

    if (score > 0) {
      scored.set(rule.stack, score);
    }
  }

  for (const dependency of dependencyNames) {
    scored.set(dependency, Math.max(scored.get(dependency) ?? 0, 5));
  }

  for (const candidate of genericQueryCandidates(query)) {
    scored.set(candidate, Math.max(scored.get(candidate) ?? 0, 2));
  }

  const sorted = [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([stack]) => stack);

  return sorted.length > 0 ? sorted : ["unknown"];
}
