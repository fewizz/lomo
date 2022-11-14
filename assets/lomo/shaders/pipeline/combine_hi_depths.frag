#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/combine_hi_depths.frag */

uniform sampler2DArray u_depths;

layout(location = 0) out vec4 out_depths;

void main() {
	out_depths = vec4(
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 1), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 2), 0).r,
		texelFetch(u_depths, ivec3(gl_FragCoord.xy, 3), 0).r
	);
}