import { KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Path } from "../sys/structural/Path";
import { clamp } from "@/sys/math";
import { Vec2 } from "@/sys/structural/Vec2";

import styles from "./pathviewer.module.css"

export interface PathClass {
    base: string,
    styles: Record<string, string>,
}
export const PATH_CLASSES = {
    DEFAULT: {
        styles,
        base: styles.path_default,
    },
    ANNOT: {
        styles,
        base: styles.path_annot,
    },
    SIMPLE: {
        styles,
        base: styles.path_simple,
    },
} as const satisfies Record<string, PathClass>

function PathLayer({
    paths,
    scale,
    path_class,
    sel,
}: {
    paths: Path[],
    scale: number,
    path_class?: PathClass,
    sel?: { sel_i: number, sel_n: number, set_i?: (i: number) => void, shift_set_i?: (i: number) => void },
}) {
    return (<>{
        paths.map((path, i) => {
            const selectable = sel != null
            const selected = selectable ? i >= sel.sel_i && i - sel.sel_i < sel.sel_n : false

            return (
                <OnePath {...{
                    path,
                    scale,
                    path_class: path_class ?? PATH_CLASSES.DEFAULT,
                    selected, selectable,
                }} key={i}
                    on_click={sel?.shift_set_i == null ? e => {
                        if (e.shiftKey) return
                        sel?.set_i?.(i)
                    } : e => {
                        if (e.ctrlKey) return
                        if (e.shiftKey) {
                            sel.shift_set_i?.(i)
                        } else {
                            sel.set_i?.(i)
                        }
                    }}
                    on_mouse_over={sel?.shift_set_i == null ? e => {
                        if (!e.ctrlKey || e.shiftKey) return
                        sel?.set_i?.(i)
                    } : () => { }}
                />
            )
        })
    }</>)
}
function TextLayer({
    text: texts,
    scale,
}: {
    text: { text: string, pos: Vec2 }[],
    scale: number,
}) {
    return (<>{
        texts.map(({ text, pos }, i) => {

            return (
                <text
                    style={{ fontFamily: "monospace", whiteSpace: "pre", textAnchor: "middle" }}
                    fill="#fff"
                    x={pos.x * scale}
                    y={pos.y * scale}
                    key={i}
                >{text}</text>
            )
        })
    }</>)
}
function OnePath({ path, scale, selected, selectable, path_class, on_click, on_mouse_over }: {
    path: Path,
    scale: number,
    selected: boolean, selectable: boolean,
    path_class: PathClass,
    on_click?: (e: MouseEvent<SVGPathElement>) => void,
    on_mouse_over?: (e: MouseEvent<SVGPathElement>) => void,
}) {
    return (
        <path
            d={path?.stringify(scale)}
            strokeWidth={2}
            className={[
                ...(path_class != null ? [
                    path_class.base,
                    selected
                        ? path_class.styles.selected
                        : selectable
                            ? path_class.styles.selectable
                            : path_class.styles.unselectable
                ] : []),
                ...(path.id != null ? [path.id.replaceAll(/\s/g, "_")] : [])
            ].join(" ")}
            stroke={path.filled ?? false ? "none" : "var(--color)"}
            fill={path.filled ?? false ? "var(--color)" : "none"}
            onClick={on_click}
            onMouseOver={on_mouse_over}
            strokeLinecap="round"
            strokeLinejoin="round"
        />)
}

export function PathViewerSimple({
    path: path_,
    size,
}: {
    path: Path[],
    size: number,
}) {
    const path = Path.conormalize(path_)
    return (<svg width={size} height={size}>
        <g transform="translate(1,1)">
            {path.map((path, i) => (
                <OnePath {...{
                    path,
                    path_class: PATH_CLASSES.SIMPLE,
                    scale: size - 2,
                    selected: false,
                    selectable: false,
                }} key={i} />
            ))}
        </g>
    </svg>)
}
export function PathViewer({
    text,
    layers,
    on_click,
}: {
    layers: {
        paths: Path[],
        key: string,
        path_class?: PathClass,
        sel?: { sel_i: number, sel_n: number, set_i?: (i: number) => void, shift_set_i?: (i: number) => void },
    }[],
    text?: { text: string, pos: Vec2 }[],
    on_click?: (e: MouseEvent, p: Vec2) => void,
}) {
    const [true_scale, set_true_scale] = useState(1)
    return (<Locator {...{ set_true_scale, true_scale, on_click }}>
        {[
            ...layers.map(({ paths, key, path_class, sel }) => (
                <PathLayer {...{ paths, path_class: path_class, sel }} scale={true_scale} key={key} />
            )),
            ...text != null ? [<TextLayer key="text" text={text} scale={true_scale} />] : []
        ]}
    </Locator>)
}

function mouse_pos(e: MouseEvent<HTMLElement | SVGElement>) {
    return {
        mouse_x: e.nativeEvent.offsetX,
        mouse_y: e.nativeEvent.offsetY,
    }
}

function Locator({
    children,
    true_scale,
    set_true_scale,
    on_click,
}: {
    children: JSX.Element[],
    true_scale: number,
    set_true_scale: (true_scale: number) => void,
    on_click?: (e: MouseEvent, p: Vec2) => void,
}) {
    const [fast_scale, set_fast_scale] = useState(1)
    const [offset_x, set_offset_x] = useState(0)
    const [offset_y, set_offset_y] = useState(0)
    const prevpos = useMemo(() => ({ x: 0, y: 0 }), [])
    const curpos = useMemo(() => ({ x: 0, y: 0 }), [])

    useEffect(() => {
        if (fast_scale === 1) return
        const timeout_id = setTimeout(() => {
            set_true_scale(fast_scale * true_scale)
            set_fast_scale(1)
        }, 100)
        return () => clearTimeout(timeout_id)
    }, [fast_scale, true_scale, set_true_scale])

    const [down, set_down] = useState(false)
    return (<svg
        width={"100vw"}
        height={"calc(80vh - 2em)"}
        onMouseDown={e => {
            const { mouse_x, mouse_y } = mouse_pos(e)
            on_click?.(e, new Vec2(((mouse_x - offset_x) / fast_scale) / true_scale, ((mouse_y - offset_y) / fast_scale) / true_scale))
            if (e.ctrlKey) return
            prevpos.x = mouse_x
            prevpos.y = mouse_y
            curpos.x = offset_x
            curpos.y = offset_y
            set_down(true)
        }}
        onMouseUp={() => set_down(false)}
        onMouseLeave={() => set_down(false)}
        onMouseMove={e => {
            const { mouse_x, mouse_y } = mouse_pos(e)
            if (!down) return
            const delta_x = mouse_x - prevpos.x
            const delta_y = mouse_y - prevpos.y
            prevpos.x = mouse_x
            prevpos.y = mouse_y
            curpos.x += delta_x
            curpos.y += delta_y
            set_offset_x(curpos.x)
            set_offset_y(curpos.y)
        }}
        onWheel={e => {
            const { mouse_x, mouse_y } = mouse_pos(e)

            const x = (mouse_x - offset_x) / fast_scale
            const y = (mouse_y - offset_y) / fast_scale
            const new_fast_scale = fast_scale * Math.exp(-e.deltaY / 1000)
            set_fast_scale(new_fast_scale)
            set_offset_x(mouse_x - x * new_fast_scale)
            set_offset_y(mouse_y - y * new_fast_scale)
        }}
    >
        <g
            transform={`matrix(${fast_scale},0,0,${fast_scale},${offset_x},${offset_y})`}
        >
            {children}
        </g>
    </svg>)
}

export function usePathSelectionState(i: number, n: number): [number, number, (i: number) => void, (n: number) => void, (i: number, n?: number) => void]
export function usePathSelectionState(i: number): [number, (i: number) => void]
export function usePathSelectionState(i_: number, n_?: number): [number, number, (i: number) => void, (n: number) => void, (i: number, n?: number) => void] | [number, (i: number) => void] {
    const [i, set_i] = useState(i_)
    if (n_ != null) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [n, set_n] = useState(n_)
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return [i, n, set_i, set_n, useCallback((i: number, n?: number) => {
            set_i(i)
            set_n(n ?? 1)
        }, [set_i, set_n])]
    } else {
        return [i, set_i]
    }
}
export function PathSelectionInput({ sel_i, sel_n, set_sel_i, set_sel_n, paths }: { sel_i: number, sel_n: number, set_sel_i: (sel_i: number) => void, set_sel_n: (sel_n: number) => void, paths: Path[] }) {
    return (<>
        <input type="number" min={0} max={paths.length - sel_n}
            value={sel_i} onChange={e => {
                let v = e.currentTarget.valueAsNumber
                if (!isFinite(v)) v = 0
                set_sel_i(clamp(Math.round(v), 0, paths.length - sel_n))
            }} />
        <input type="number" min={1} max={paths.length - sel_i}
            value={sel_n} onChange={e => {
                let v = e.currentTarget.valueAsNumber
                if (!isFinite(v)) v = 1
                set_sel_n(clamp(Math.round(v), 1, paths.length - sel_i))
            }} />
    </>)
}
export function PathSelectionInputSingle({ sel_i, set_sel_i }: { sel_i: number, set_sel_i: (i: number) => void }) {
    return (<>
        <input value={sel_i} onChange={e => {
            let v = e.currentTarget.valueAsNumber
            if (!isFinite(v)) v = 0
            set_sel_i(v)
        }} />
    </>)
}

export function usePathSelectionOnKeyDown(
    paths: Path[],
    sel_i: number, set_sel_i: (sel_i: number) => void,
    sel_n: number, set_sel_n: (sel_n: number) => void,
): (e: KeyboardEvent) => void
export function usePathSelectionOnKeyDown(
    paths: Path[],
    sel_i: number, set_sel_i: (sel_i: number) => void,
): (e: KeyboardEvent) => void
export function usePathSelectionOnKeyDown(
    paths: Path[],
    sel_i: number, set_sel_i: (sel_i: number) => void,
    sel_n?: number, set_sel_n?: (sel_n: number) => void,
): (e: KeyboardEvent) => void {
    return useCallback((e: KeyboardEvent) => {
        const ilen = paths.length + 1 - (sel_n ?? 1)
        switch (e.key) {
            case "ArrowRight":
                if (e.shiftKey && set_sel_n != undefined) {
                    set_sel_n(Math.min(sel_n! + 1, paths.length - sel_i))
                } else {
                    set_sel_i((sel_i + 1) % ilen)
                }
                break
            case "ArrowLeft":
                if (e.shiftKey && set_sel_n != undefined) {
                    set_sel_n(Math.max(sel_n! - 1, 1))
                } else {
                    set_sel_i((sel_i + ilen - 1) % ilen)
                }
                break
        }
    }, [paths.length, sel_i, sel_n, set_sel_i, set_sel_n])
}