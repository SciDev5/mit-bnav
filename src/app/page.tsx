'use client';

import Image from "next/image";
import styles from "./page.module.css";
import { Suspense, useEffect, useRef, useState } from "react";
import { Path } from "@/sys/structural/Path";
import { Font, RequireNearbyLevel } from "@/sys/pattern_matching/Font";
import { PathViewer, usePathSelectionOnKeyDown } from "@/components/PathViewer";
import { FloorImporter } from "@/components/FloorImporter";
import { DoorPatternEditor, FontEditor, useDoorMatcher, useDoorPatterns, useDoorPatternsJSON, useFont, useFontJSON } from "@/components/FontEditor";
import { Mesh2 } from "@/sys/structural/Mesh2";
import { Rect2 } from "@/sys/structural/Rect2";
import { Vec2 } from "@/sys/structural/Vec2";
import { FloorEditor } from "@/components/FloorEditor";


export default function Home() {
    const [paths, set_paths] = useState<Path[]>([])
    const [loading_paths, set_loading_paths] = useState<Path[] | null>(null)
    const [q, set_q] = useState<Path[]>([])
    const [mesh, set_mesh] = useState<Mesh2>(Mesh2.from_paths([]))
    const [p_m, set_p_m] = useState<Path[]>([])
    const [sel_i, set_sel_i] = useState(0)
    const [sel_n, set_sel_n] = useState(1)
    const [show_words, set_show_words] = useState(false)
    const [hide_words, set_hide_words] = useState(false)

    const [interiors, set_interiors] = useState<Path[]>([])

    const [k, set_k] = useState(false)

    const [font_json] = useFontJSON()
    const font = useFont(font_json)
    const [doorpatterns_json] = useDoorPatternsJSON()
    const door_matcher = useDoorMatcher(doorpatterns_json)

    useEffect(() => {
        const pr = paths.map(v => v.bounding_box()).reduce((a, b) => a.dim.mag_sq() > b.dim.mag_sq() ? a : b, new Rect2(new Vec2(0, 0), new Vec2(0, 0)))
        const paths_ = paths.filter(v => v.bounding_box().intersects(pr) && v.bounding_box().dim.mag_sq() < pr.dim.mag_sq())


        const l = font.find_symbols(paths_, 0.1)
        const w = font.wordify(l, 0.1)
        // const d = door_matcher.find_doors(paths, 0.1)
        // console.log(l, w);
        set_q(w.flatMap(({ str, bb }) => Path.parse_dstr(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + str.map(v => v.ch).join(""))))

        // const d = Font.DOORS.find_symbols_rotated(paths, 0.1)
        // console.log("d", d);

        // set_q(d.flatMap(({ bb }) => Path.parse_dstr(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER")))

        const remove_indices = [...w.flatMap(v => v.str)].sort((a, b) => b.i - a.i)
        // const remove_indices = [...w.flatMap(v => v.str), ...d].sort((a, b) => b.i - a.i)

        const p_m = [...paths_]
        for (const { i, n } of remove_indices) {
            p_m.splice(i, n)
        }
        const m = Mesh2.from_paths(p_m)
        m.merge_by_dist_simple(2)
        m.splice_line_intersections(3, false, true)
        m.merge_by_dist_simple(3)
        m.splice_line_intersections(-1, true, false)
        m.splice_line_intersections(0.1, false, true)
        m.merge_by_dist_simple(0.1)

        // m.merge_by_dist_simple(100)
        set_mesh(m)
        set_p_m(m.to_paths())
        set_interiors(
            m.trace_interiors_as_vec2()
                .map(v => [v, Vec2.loop_signed_area(v)] satisfies [any, any])
                .filter(v => v[1] > 0)
                .sort((a, b) => b[1] - a[1])
                // .slice(0, 50)
                .map(v => new Path(v[0], true, false, undefined, "INTR"))
        )
    }, [paths, font, door_matcher])

    const path_selection_on_key_down = usePathSelectionOnKeyDown(paths, sel_i, set_sel_i, sel_n, set_sel_n)

    return (
        <div
            onKeyDown={e => {
                switch (e.key) {
                    case "Backspace":
                        paths.splice(sel_i, sel_n)
                        set_paths([...paths])
                        set_sel_n(1)
                        break
                    default: path_selection_on_key_down(e)
                }
            }}
            tabIndex={0}
        >
            {loading_paths && <FloorImporter paths={loading_paths} export_scaled_paths={paths => { set_loading_paths(null); set_paths(paths) }} />}
            <input type={"file"} onChange={async e => {
                const svg_source = await (e.currentTarget.files ?? [])[0]?.text()
                if (svg_source == null) return
                const paths_new = Path.load_paths(svg_source)
                if (paths_new == null) return
                set_loading_paths(paths_new)
                // set_paths(paths_new)
            }} />

            <button onClick={() => {
                console.log(
                    paths.slice(sel_i, sel_i + sel_n).map(v => [v.points.map(({ x, y }) => [x, y]), v.loop])
                );
            }}>export</button>

            <label htmlFor="s">show_words <input id="s" type="checkbox" checked={show_words} onChange={e => { set_show_words(e.currentTarget.checked) }} /></label>
            <label htmlFor="h">hide_words <input id="h" type="checkbox" checked={hide_words} onChange={e => { set_hide_words(e.currentTarget.checked) }} /></label>

            <input value={sel_i} type="number" min={0} max={paths.length - 1} step={1} onChange={e => { set_sel_i(e.currentTarget.valueAsNumber) }} />
            <input value={sel_n} type="number" min={1} max={paths.length} step={1} onChange={e => { set_sel_n(e.currentTarget.valueAsNumber) }} />

            <input type="checkbox" checked={k} onChange={e => { set_k(e.currentTarget.checked) }} />

            {k ? (
                <Suspense>
                    <H paths={paths} />
                </Suspense>
            ) : (

                <FloorEditor mesh={mesh} />
                // <PathViewer layers={[
                //     {
                //         key: "z",
                //         paths: interiors,
                //         path_class: "INTR",
                //     },
                //     ...(show_words ? [{
                //         paths: q,
                //         key: "letters",
                //         path_class: "LETTER",
                //     }] : []),
                //     hide_words ? {
                //         paths: p_m,
                //         key: "paths",
                //     } : {
                //         paths: paths,
                //         key: "paths",
                //         sel: {
                //             sel_i, sel_n, set_i(i) {
                //                 set_sel_i(i)
                //                 set_sel_n(1)
                //             },
                //         }
                //     },
                // ]} />
            )}
        </div>
    );
}

function H({ paths }: { paths: Path[] }) {
    const [font_json, set_font_json] = useFontJSON()
    const [doorpatterns_json, set_doorpatterns_json] = useDoorPatternsJSON()

    return (<>
        <FontEditor {...{ font_json, set_font_json, paths }} />
        {/* <DoorPatternEditor {...{ doorpatterns_json, set_doorpatterns_json, paths }} /> */}
    </>)
}