'use client';

import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef, useState } from "react";
import { APath, DPath, Font, load_svg, Vec2 } from "@/sys/svg";
import { DPathViewer } from "@/sys/DPathViewer";

const r: Record<string, any> = {}
const remaining = new Set("qwertyuiopasdfghjklzxcvbnm1234567890/")

export default function Home() {
    const [p, set_p] = useState<DPath[]>([])
    const [p_m, set_p_m] = useState<DPath[]>([])
    const [q, set_q] = useState<DPath[]>([])
    const [sel_i, set_sel_i] = useState(0)
    const [sel_q, set_sel_q] = useState(0)
    const [show_words, set_show_words] = useState(false)
    const [hide_words, set_hide_words] = useState(false)

    useEffect(() => {
        const k = p.map(v => APath.from_d(v))
        const imap = k.flatMap((v, i) => v.map(() => i))
        const l = Font.DEFAULT.find_letters(k.flat(), 0.1)
        const w = Font.DEFAULT.wordify(l, 0.1)
        console.log(l, w);
        // set_q(l.map(({ ch, bb }) => DPath.parse(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + ch)))
        set_q(w.map(({ str, bb }) => DPath.parse(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + str.map(v => v.ch).join(""))))

        const wl = w.flatMap(v => v.str).sort((a, b) => b.i - a.i)
        // const wl = l.map(v => v).sort((a, b) => b.i - a.i)
        console.log(wl.filter((_, i, a) => i > 1 && (a[i - 1].i < a[i].i + a[i].n || imap[a[i - 1].i] < imap[a[i].i + a[i].n])).map(v => [[v.i, v.n], [imap[v.i], imap[v.i + v.n - 1] + 1 - imap[v.i]], v.ch]));
        // console.log(wl.filter((_, i, a) => i > 1 && (a[i - 1].i < a[i].i + a[i].n || imap[a[i - 1].i] <= imap[a[i].i + a[i].n - 1])).map(v => [[v.i, v.n], [imap[v.i], imap[v.i + v.n - 1] + 1 - imap[v.i]], v.ch]));

        const p_m = p.map(v => v)
        for (const { i, n } of wl) {
            p_m.splice(imap[i], imap[i + n] - imap[i])
            // p_m.splice(imap[i], imap[i + n - 1] + 1 - imap[i])
        }
        set_p_m(p_m)
    }, [p])

    return (
        <>
            <input type={"file"} onChange={async e => {
                const d = await (e.currentTarget.files ?? [])[0]?.text()
                if (d == null) {
                    return
                }

                const svg = load_svg(d)
                if (svg == null) {
                    return
                }

                const z = svg.querySelectorAll("path")
                const s = [...z].map(v => DPath.parse(v.getAttribute("d")!, { filled: v.style.fill != "none" }, v.id))
                // s.forEach(v => v.scale(new Vec2(0.1, -0.1)).offset(new Vec2(0, 700)))
                s.forEach(v => v.scale(new Vec2(0.1, 0.1)))

                set_p(s)

            }} />
            <button onClick={() => {
                p.forEach(v => v.swap_xy())
                set_p([...p])
            }}>flip_xy</button>
            <button onClick={() => {
                p.forEach(v => v.scale(new Vec2(1, -1)).offset(new Vec2(0, 700)))
                set_p([...p])
            }}>flip_y</button>
            <button onClick={() => {
                p.forEach(v => v.scale(new Vec2(-1, 1)).offset(new Vec2(700, 0)))
                set_p([...p])
            }}>flip_x</button>
            <button onClick={() => {
                p.splice(sel_i, sel_q)
                set_p([...p])
            }}>delete</button>
            <button onClick={() => {
                const gen = APath.conormalize(p.slice(sel_i, sel_i + sel_q).flatMap(v => APath.from_d(v))).map(v => [v.points.map(({ x, y }) => [x, y]), v.loop])
                const ch = prompt("what letter")
                if (ch == null) {
                    return
                }
                remaining.delete(ch)

                r[ch] = gen
                console.log(remaining);
                console.log(ch, gen);
            }}>export</button>
            <button onClick={() => { console.log(r) }}>all exports</button>
            <input value={sel_q} type="number" min={1} max={p.length} step={1} onChange={e => { set_sel_q(e.currentTarget.valueAsNumber) }} />
            show_words<input type="checkbox" checked={show_words} onChange={e => { set_show_words(e.currentTarget.checked) }} />
            hide_words<input type="checkbox" checked={hide_words} onChange={e => { set_hide_words(e.currentTarget.checked) }} />
            <svg width={"10000"} height={"10000"} style={{ background: "#000" }} >
                {hide_words
                    ? <DPathViewer paths={p_m} />
                    : <DPathViewer paths={p} sel={{ i: sel_i, len: sel_q, set_sel_i }} />
                }

                {show_words && <DPathViewer paths={q} />}
            </svg>
        </>
    );
}
