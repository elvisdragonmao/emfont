import type { CollectionEntry } from "astro:content";

export type DocEntry = CollectionEntry<"docs">;

export interface DocsMeta {
  title?: string;
  pages?: string[];
  root?: boolean;
  icon?: string;
}

export interface DocNavItem {
  title: string;
  url: string;
  route: string;
  entry?: DocEntry;
  children: DocNavItem[];
}

export interface DocNavSection {
  title?: string;
  items: DocNavItem[];
}

const metaModules = import.meta.glob("../content/docs/**/meta.json", {
  eager: true,
  import: "default"
}) as Record<string, DocsMeta>;

const metaByDir = new Map<string, DocsMeta>();

for (const [path, meta] of Object.entries(metaModules)) {
  const marker = "/content/docs/";
  const afterMarker = path.includes(marker) ? path.split(marker).at(-1) : path.replace("../content/docs/", "");
  const dir = afterMarker?.replace(/\/?meta\.json$/, "") ?? "";
  metaByDir.set(dir === "meta.json" ? "" : dir, meta);
}

export function routeFromEntryId(id: string) {
  const route = id.replace(/\.(md|mdx)$/, "").replace(/\/index$/, "");
  return route === "index" ? "" : route;
}

export function routeKey(route: string) {
  return route || "index";
}

export function urlFromRoute(route: string) {
  return route ? `/docs/${route}` : "/docs";
}

export function routeFromSlug(slug?: string[]) {
  return slug?.length ? slug.join("/") : "";
}

export function findDocEntry(entries: DocEntry[], route: string) {
  const key = routeKey(route);
  return entries.find((entry) => routeKey(routeFromEntryId(entry.id)) === key);
}

function entryByRoute(entries: DocEntry[]) {
  return new Map(entries.map((entry) => [routeKey(routeFromEntryId(entry.id)), entry]));
}

function titleForEntry(entry: DocEntry | undefined, fallback: string) {
  return entry?.data.title ?? fallback;
}

function buildFolderItem(folder: string, entriesByRoute: Map<string, DocEntry>): DocNavItem | undefined {
  const meta = metaByDir.get(folder);
  const entry = entriesByRoute.get(folder);
  const children = buildItems(folder, entriesByRoute);

  if (!entry && children.length === 0) {
    return undefined;
  }

  const title = meta?.title ?? titleForEntry(entry, folder);
  return {
    title,
    url: urlFromRoute(folder),
    route: folder,
    entry,
    children
  };
}

function buildItems(dir: string, entriesByRoute: Map<string, DocEntry>) {
  const meta = metaByDir.get(dir);
  const pages = meta?.pages ?? [];
  const items: DocNavItem[] = [];

  for (const page of pages) {
    if (page.startsWith("---") && page.endsWith("---")) {
      continue;
    }

    const route = dir ? `${dir}/${page}` : page;
    const folderItem = metaByDir.has(route) ? buildFolderItem(route, entriesByRoute) : undefined;

    if (folderItem) {
      items.push(folderItem);
      continue;
    }

    const entry = entriesByRoute.get(routeKey(route));
    if (!entry) {
      continue;
    }

    items.push({
      title: titleForEntry(entry, page),
      url: urlFromRoute(routeFromEntryId(entry.id)),
      route: routeFromEntryId(entry.id),
      entry,
      children: []
    });
  }

  return items;
}

export function buildDocsNavigation(entries: DocEntry[]) {
  const entriesByRoute = entryByRoute(entries);
  const rootMeta = metaByDir.get("") ?? {};
  const sections: DocNavSection[] = [];
  let current: DocNavSection = { items: [] };

  for (const page of rootMeta.pages ?? []) {
    if (page.startsWith("---") && page.endsWith("---")) {
      if (current.items.length > 0 || current.title) {
        sections.push(current);
      }

      current = { title: page.replaceAll("-", ""), items: [] };
      continue;
    }

    const folderItem = metaByDir.has(page) ? buildFolderItem(page, entriesByRoute) : undefined;
    if (folderItem) {
      current.items.push(folderItem);
      continue;
    }

    const entry = entriesByRoute.get(routeKey(page));
    if (!entry) {
      continue;
    }

    current.items.push({
      title: titleForEntry(entry, page),
      url: urlFromRoute(routeFromEntryId(entry.id)),
      route: routeFromEntryId(entry.id),
      entry,
      children: []
    });
  }

  if (current.items.length > 0 || current.title) {
    sections.push(current);
  }

  return sections;
}

export function flattenDocsNavigation(sections: DocNavSection[]) {
  const result: DocNavItem[] = [];

  function visit(item: DocNavItem) {
    if (item.entry) {
      result.push(item);
    }

    item.children.forEach(visit);
  }

  sections.forEach((section) => section.items.forEach(visit));
  return result;
}

export function isActiveDoc(item: DocNavItem, currentRoute: string) {
  const current = routeKey(currentRoute);
  const route = routeKey(item.route);
  return current === route || (route !== "index" && current.startsWith(`${route}/`));
}

export function getAdjacentDocs(items: DocNavItem[], currentRoute: string) {
  const index = items.findIndex((item) => routeKey(item.route) === routeKey(currentRoute));
  return {
    previous: index > 0 ? items[index - 1] : undefined,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : undefined
  };
}

export function getAllDocSearchItems(entries: DocEntry[]) {
  return entries
    .map((entry) => {
      const route = routeFromEntryId(entry.id);
      return {
        title: entry.data.title,
        description: entry.data.description ?? "",
        url: urlFromRoute(route)
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
}
