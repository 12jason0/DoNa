import { useEffect, useState } from "react";

export type RegionEntry = {
    name: string;
    name_en?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
};

export type RegionMap = Record<string, RegionEntry>;

let _cache: RegionMap | null = null;

export function useRegions(): RegionMap {
    const [map, setMap] = useState<RegionMap>(_cache ?? {});

    useEffect(() => {
        if (_cache) { setMap(_cache); return; }
        fetch("/api/regions")
            .then((r) => r.json())
            .then((data: RegionEntry[]) => {
                const m: RegionMap = {};
                data.forEach((r) => { m[r.name] = r; });
                _cache = m;
                setMap(m);
            })
            .catch(() => {});
    }, []);

    return map;
}
