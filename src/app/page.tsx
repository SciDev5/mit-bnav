'use client';

import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef, useState } from "react";
import { Path, Font, Vec2 } from "@/sys/svg";
import { PathViewer } from "@/sys/PathViewer";

const r: Record<string, any> = {}
const remaining = new Set("qwertyuiopasdfghjklzxcvbnm1234567890/")

export default function Home() {
    const [paths, set_paths] = useState<Path[]>([])
    const [q, set_q] = useState<Path[]>([])
    const [p_m, set_p_m] = useState<Path[]>([])
    const [sel_i, set_sel_i] = useState(0)
    const [sel_q, set_sel_q] = useState(1)
    const [show_words, set_show_words] = useState(false)
    const [hide_words, set_hide_words] = useState(false)

    useEffect(() => {
        const l = Font.DEFAULT.find_symbols(paths, 0.1)
        const w = Font.DEFAULT.wordify(l, 0.1)
        // console.log(l, w);
        set_q(w.flatMap(({ str, bb }) => Path.parse_dstr(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + str.map(v => v.ch).join(""))))

        const wl = w.flatMap(v => v.str).sort((a, b) => b.i - a.i)

        const p_m = [...paths]
        for (const { i, n } of wl) {
            p_m.splice(i, n)
        }
        set_p_m(p_m)
    }, [paths])

    return (
        <div
            onKeyDown={e => {
                const ilen = paths.length + 1 - sel_q
                switch (e.key) {
                    case "Backspace":
                        paths.splice(sel_i, sel_q)
                        set_paths([...paths])
                        set_sel_q(1)
                        break
                    case "ArrowRight":
                        if (e.shiftKey) {
                            set_sel_q(Math.min(sel_q + 1, paths.length - sel_i))
                        } else {
                            set_sel_i((sel_i + 1) % ilen)
                        }
                        break
                    case "ArrowLeft":
                        if (e.shiftKey) {
                            set_sel_q(Math.max(sel_q - 1, 1))
                        } else {
                            set_sel_i((sel_i + ilen - 1) % ilen)
                        }
                        break
                }
            }}
            tabIndex={0}
        >
            <input type={"file"} onChange={async e => {
                const svg_source = await (e.currentTarget.files ?? [])[0]?.text()
                if (svg_source == null) return
                const paths_new = Path.load_paths(svg_source)
                if (paths_new == null) return
                set_paths(paths_new)
            }} />

            <label htmlFor="s">show_words <input id="s" type="checkbox" checked={show_words} onChange={e => { set_show_words(e.currentTarget.checked) }} /></label>
            <label htmlFor="h">hide_words <input id="h" type="checkbox" checked={hide_words} onChange={e => { set_hide_words(e.currentTarget.checked) }} /></label>

            <input value={sel_i} type="number" min={0} max={paths.length - 1} step={1} onChange={e => { set_sel_i(e.currentTarget.valueAsNumber) }} />
            <input value={sel_q} type="number" min={1} max={paths.length} step={1} onChange={e => { set_sel_q(e.currentTarget.valueAsNumber) }} />

            <PathViewer layers={[
                ...(show_words ? [{
                    paths: q,
                    key: "letters",
                    path_class: "LETTER",
                }] : []),
                hide_words ? {
                    paths: p_m,
                    key: "paths",
                } : {
                    paths: paths,
                    key: "paths",
                    sel: {
                        i: sel_i, len: sel_q, set_i(i) {
                            set_sel_i(i)
                            set_sel_q(1)
                        },
                    }
                },
            ]} />
        </div>
    );
}
