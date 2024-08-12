import { Font, FontJSON, RequireNearbyLevel } from "@/sys/pattern_matching/Font";
import { useLocalhost } from "@/sys/use";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PathSelectionInput, PathViewer, PathViewerSimple, usePathSelectionOnKeyDown, usePathSelectionState } from "./PathViewer";
import { Path } from "@/sys/structural/Path";
import { DoorMatcher, DoorPattern, doorpattern_from_json, DoorPatternJSON } from "@/sys/pattern_matching/Door";
import { Vec2 } from "@/sys/structural/Vec2";
import { Rect2 } from "@/sys/structural/Rect2";

const LOCALSTORAGE_IDS = {
    FONT: "_bnav_font",
    DOORSPECS: "_bnav_doorspecs",
} as const
const FONT_JSON_DEFAULT = { map: {} }
export function useFontJSON(): [FontJSON, (font: FontJSON) => void] {
    return useLocalhost(LOCALSTORAGE_IDS.FONT, FONT_JSON_DEFAULT)
}
export function useFont(font: FontJSON): Font {
    return useMemo(() => Font.from_json(font), [font])
}
const DOORPATTERNS_JSON_DEFAULT = [] as DoorPatternJSON[]
export function useDoorPatternsJSON(): [DoorPatternJSON[], (font: DoorPatternJSON[]) => void] {
    return useLocalhost(LOCALSTORAGE_IDS.DOORSPECS, DOORPATTERNS_JSON_DEFAULT)
}
export function useDoorPatterns(doors: DoorPatternJSON[]): DoorPattern[] {
    return useMemo(() => doors.map(doorpattern_from_json), [doors])
}
export function useDoorMatcher(doors: DoorPatternJSON[]): DoorMatcher {
    return useMemo(() => new DoorMatcher(doors.map(doorpattern_from_json)), [doors])
}


export function FontEditor({ paths, font_json, set_font_json }: { paths: Path[], font_json: FontJSON, set_font_json: (font: FontJSON) => void }) {
    const [words_highlight, set_words_highlight] = useState<Path[]>([])
    const [paths_text_negative, set_paths_text_negative] = useState<Path[]>([])

    const [view_mode, set_view_mode] = useState(false)

    const [sel_i, sel_n, set_sel_i, set_sel_n, set_sel] = usePathSelectionState(0, 1)

    const path_selection_on_key_down = usePathSelectionOnKeyDown(paths, sel_i, set_sel_i, sel_n, set_sel_n)
    const add_symbol = useCallback(() => {
        const ch = prompt("what letter is this")
        if (ch == null) return
        font_json.map[ch] ??= { info: { needs_others_nearby: RequireNearbyLevel.None }, variants: [] }
        const path = Path.conormalize(paths.slice(sel_i, sel_i + sel_n)).map(p => p.to_json())
        if (
            !font_json.map[ch].variants.some(
                ({ path: p }) => p.every((v, i) =>
                    v.loop == path[i].loop &&
                    v.points.length == path[i].points.length &&
                    v.points.every((p, j) => Vec2.from_json(path[i].points[j]).dist_sq(Vec2.from_json(p)) < 0.009)
                )
            )
        ) {
            font_json.map[ch].variants.push({
                path,
                h_rel: 1,
                y_off: 0,
            })
            set_font_json({ ...font_json })
        }
    }, [sel_i, sel_n, set_font_json, font_json, paths])

    useEffect(() => {
        const pr = paths.map(v => v.bounding_box()).reduce((a, b) => a.dim.mag_sq() > b.dim.mag_sq() ? a : b, new Rect2(new Vec2(0, 0), new Vec2(0, 0)))
        const paths_ = paths.filter(v => v.bounding_box().intersects(pr) && v.bounding_box().dim.mag_sq() < pr.dim.mag_sq())


        const l = font.find_symbols(paths_, 0.1)
        const w = font.wordify(l, 0.1)
        // const d = door_matcher.find_doors(paths, 0.1)
        // console.log(l, w);
        set_words_highlight(w.flatMap(({ str, bb }) => Path.parse_dstr(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + str.map(v => v.ch).join(""))))


        const remove_indices = [...w.flatMap(v => v.str)].sort((a, b) => b.i - a.i)
        // const remove_indices = [...w.flatMap(v => v.str), ...d].sort((a, b) => b.i - a.i)

        const p_m = [...paths_]
        for (const { i, n } of remove_indices) {
            p_m.splice(i, n)
        }
        set_paths_text_negative(p_m)
    }, [font_json])

    const font = useFont(font_json)

    return (
        <div
            onKeyDown={e => {
                switch (e.key) {
                    case "Enter":
                        add_symbol()
                        break
                    default:
                        path_selection_on_key_down(e)
                }
            }}
            tabIndex={0}
        >
            <input checked={view_mode} onChange={e => set_view_mode(e.currentTarget.checked)} type="checkbox" />
            <PathSelectionInput {...{ sel_i, sel_n, set_sel_i, set_sel_n, paths }} />
            <button onClick={add_symbol}>add symbol</button>
            <div style={{ maxHeight: "10vh", overflow: "scroll", display: "flex", flexWrap: "wrap" }}>
                {Object.entries(font_json.map).map(([ch, { variants, info }]) => (
                    <div key={ch} style={{ flex: "1 1", minWidth: "5em" }}>
                        <span>{ch}</span>

                        <select value={info.needs_others_nearby} onChange={e => {
                            font_json.map[ch].info.needs_others_nearby = parseInt(e.currentTarget.value)
                            set_font_json({ ...font_json })
                        }}>
                            <option value={RequireNearbyLevel.None}>None</option>
                            <option value={RequireNearbyLevel.Weak}>Weak</option>
                            <option value={RequireNearbyLevel.Strong}>Strong</option>
                        </select>
                        {
                            variants.map(({ path, h_rel, y_off }, i) => (
                                <span key={i} onClick={() => {
                                    if (!confirm("remove variant")) return
                                    variants.splice(i, 1)
                                    set_font_json({ ...font_json })
                                }}>
                                    <PathViewerSimple
                                        path={path.map(Path.from_json)}
                                        size={32}
                                    />
                                </span>
                            ))
                        }
                    </div>
                ))}
            </div>
            <PathViewer
                layers={[
                    {
                        paths: words_highlight,
                        key: "words",
                        path_class: "LETTER",
                    },
                    view_mode ? {
                        paths: paths_text_negative,
                        key: "neg",
                    } : {
                        paths,
                        key: "",
                        sel: {
                            sel_i,
                            sel_n,
                            set_i: set_sel,
                        }
                    }
                ]} />
        </div>
    )
}

export function DoorPatternEditor({
    paths,
    doorpatterns_json,
    set_doorpatterns_json,
}: {
    paths: Path[],
    doorpatterns_json: DoorPatternJSON[],
    set_doorpatterns_json: (doors: DoorPatternJSON[]) => void
}) {
    const [sel_i, sel_n, set_sel_i, set_sel_n, set_sel] = usePathSelectionState(0, 1)

    const path_selection_on_key_down = usePathSelectionOnKeyDown(paths, sel_i, set_sel_i, sel_n, set_sel_n)
    const add_door = useCallback(() => {
        if (!confirm("add door spec?")) return
        set_doorpatterns_json(doorpatterns_json.concat([{
            path: Path.conormalize(paths.slice(sel_i, sel_i + sel_n)).map(p => p.to_json()),
            paths_cut: paths.map(() => true),
        }]))
    }, [doorpatterns_json, set_doorpatterns_json, sel_i, sel_n, paths])
    const remove_door = (i: number) => () => {
        if (!confirm("delete door spec?")) return
        doorpatterns_json.splice(i, 1)
        set_doorpatterns_json([...doorpatterns_json])
    }
    return (
        <div
            onKeyDown={e => {
                switch (e.key) {
                    case "Enter":
                        add_door()
                        break
                    default:
                        path_selection_on_key_down(e)
                }
            }}
            tabIndex={0}
        >
            <PathSelectionInput {...{ sel_i, sel_n, set_sel_i, set_sel_n, paths }} />
            <button onClick={add_door}>add door</button>
            <div style={{ maxHeight: "10vh", overflow: "scroll", display: "flex", flexWrap: "wrap" }}>
                {doorpatterns_json.map(({ path, paths_cut }, i) => (
                    <div key={i} style={{ flex: "1 1", minWidth: "5em" }}>
                        <button onClick={remove_door(i)}>delete</button>
                        <button onClick={() => {
                            const { path, paths_cut } = doorpatterns_json[i]
                            doorpatterns_json.splice(i, 1, { path: path.map(path => Path.from_json(path).rotated(new Vec2(0, 1)).to_json()), paths_cut })
                            set_doorpatterns_json([...doorpatterns_json])
                        }}>rotate 90</button>
                        <button onClick={() => {
                            const { path, paths_cut } = doorpatterns_json[i]
                            doorpatterns_json.splice(i, 1, { path: path.map(path => Path.from_json(path).flipped_xy().to_json()), paths_cut })
                            set_doorpatterns_json([...doorpatterns_json])
                        }}>flip x/y</button>
                        <PathViewerSimple
                            path={path.map(Path.from_json)}
                            size={32}
                            key={i}
                        />
                    </div>
                ))}
            </div>
            <PathViewer
                layers={[
                    {
                        paths,
                        key: "",
                        sel: {
                            sel_i,
                            sel_n,
                            set_i: set_sel,
                        }
                    }
                ]} />
        </div>
    )
}