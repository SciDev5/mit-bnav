'use client';

import styles from "./page.module.css";
import { useCallback, useEffect, useState } from "react";
import { Path } from "@/sys/structural/Path";
import { FloorImporter } from "@/components/FloorImporter";
import { FontEditor, useFont, useFontJSON } from "@/components/FontEditor";
import { Mesh2 } from "@/sys/structural/Mesh2";
import { Rect2 } from "@/sys/structural/Rect2";
import { Vec2 } from "@/sys/structural/Vec2";
import { FloorEditor } from "@/components/FloorEditor";
import { Floor, FloorJSON, FloorLayout } from "@/sys/floor";
import { CopyPasteJSON } from "@/components/CopyPasteJSON";


export default function Home() {
    const [paths, set_paths] = useState<Path[]>([])
    const [floor, set_floor] = useState<null | Floor>(null)
    const [loading_paths, set_loading_paths] = useState<Path[] | null>(null)
    const [font_json, set_font_json] = useFontJSON()
    const font = useFont(font_json)

    const [show_font_editor, set_show_font_editor] = useState(false)

    const mark_floor_changed = useCallback(() => {
        floor?.save_localstorage()
    }, [floor])


    useEffect(() => {
        if (paths.length === 0) {
            set_floor(null)
            return
        }

        const bb_outer = paths.map(v => v.bounding_box()).reduce((a, b) => a.dim.mag_sq() > b.dim.mag_sq() ? a : b, new Rect2(new Vec2(0, 0), new Vec2(0, 0)))
        const paths_ = paths.filter(v => v.bounding_box().intersects(bb_outer) && v.bounding_box().dim.mag_sq() < bb_outer.dim.mag_sq())
        const paths_min = Rect2.from_points(...paths_.flatMap(v => v.points)).pos
        paths_.forEach(v => v.points.forEach(p => {
            p.x -= paths_min.x
            p.y -= paths_min.y
        }))

        const letters = font.find_symbols(paths_, 0.1)
        const words = font.wordify(letters, 0.1)

        const remove_indices = [...words.flatMap(v => v.str)].sort((a, b) => b.i - a.i)
        const paths_cleaned = [...paths_]
        for (const { i, n } of remove_indices) {
            paths_cleaned.splice(i, n)
        }

        const mesh = Mesh2.from_paths(paths_cleaned)
        mesh.merge_by_dist_simple(2)
        mesh.splice_line_intersections(3, false, true)
        mesh.merge_by_dist_simple(3)
        mesh.splice_line_intersections(-1, true, false)
        mesh.splice_line_intersections(0.1, false, true)
        mesh.merge_by_dist_simple(0.1)


        set_floor(new Floor(
            prompt("building id:") ?? "",
            parseInt(prompt("floor number:") ?? "0"),
            paths,
            words,
            mesh,
            new FloorLayout([], []),
        ))
    }, [paths, font])


    return (
        <div>
            <div>
                <input type={"file"} onChange={async e => {
                    const svg_source = await (e.currentTarget.files ?? [])[0]?.text()
                    if (svg_source == null) return
                    const paths_new = Path.load_paths(svg_source)
                    if (paths_new == null) return
                    set_loading_paths(paths_new)
                }} />
                <button onClick={() => {
                    const floor = Floor.load_localstorage()
                    if (floor) {
                        set_floor(floor)
                    } else {
                        alert("load failed")
                    }
                }}>load stored</button>
                <CopyPasteJSON
                    name="floor"
                    value={floor && (() => floor.to_json())}
                    set_value={json => set_floor(Floor.from_json(json))}
                    check={(json: any): json is FloorJSON => (
                        ("building" in json) && ("floor" in json) && ("raw" in json) && ("words" in json) && ("mesh" in json) && ("rooms" in json)
                    )}
                />
            </div>
            {loading_paths ? (
                <FloorImporter paths={loading_paths} export_scaled_paths={paths => { set_loading_paths(null); set_paths(paths) }} />
            ) : (<>
                <input type="checkbox" checked={show_font_editor} onChange={e => { set_show_font_editor(e.currentTarget.checked) }} />

                {show_font_editor ? (
                    <FontEditor {...{ font_json, set_font_json, paths }} />
                ) : (
                    floor && <FloorEditor {...{ mark_floor_changed, floor }} />
                )}
            </>)}
        </div>
    );
}
