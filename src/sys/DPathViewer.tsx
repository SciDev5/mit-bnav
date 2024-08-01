import { APath, DPath } from "./svg";

export function DPathViewer(props: { paths: DPath[], sel?: { i: number, len: number, set_sel_i?: (i: number) => void } }) {
    return (<>
        {
            props.paths.map((v, i) => {
                const color = props.sel
                    ? (i >= props.sel.i && i - props.sel.i < props.sel.len ? "#0f0" : "#fff")
                    : "#fff"

                return (
                    <path
                        d={v.stringify()}
                        strokeWidth={0.5}
                        className={v.id}
                        stroke={v.style.filled ?? false ? "transparent" : color}
                        fill={v.style.filled ?? false ? color : "transparent"}
                        key={i}
                        onClick={() => props.sel?.set_sel_i?.(i)}
                    />
                )
            })
        }
    </>)
}