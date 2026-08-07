import { useEffect, useMemo } from 'react'
import { ShaderMaterial, type ShaderMaterialParameters } from 'three'

/**
 * Build the ShaderMaterial ourselves and attach it with <primitive>.
 *
 * Passing `uniforms={obj}` to <shaderMaterial> does NOT give the material your
 * object — R3F hands it to the constructor, which clones it — so writing to the
 * object you memoised updates nothing and every animated uniform silently
 * freezes at its initial value. Owning the material means `material.uniforms` is
 * the object we mutate, and there is only one of it.
 */
export function useShaderMaterial(params: ShaderMaterialParameters) {
  const material = useMemo(
    () => new ShaderMaterial(params),
    // Shaders and uniform *shapes* are static per component; per-frame values are
    // mutated, never re-passed. Rebuilding here would recompile the program.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // <primitive> does not take ownership, so the disposal is ours too.
  useEffect(() => () => material.dispose(), [material])

  return material
}
