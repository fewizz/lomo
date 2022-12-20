#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/combine_hi_depth.frag */

uniform sampler2DArray u_depth;

layout(location = 0) out vec4 out_depth;

void main() {
	out_depth = vec4(
		texelFetch(u_depth, ivec3(gl_FragCoord.xy, 0), 0).r,
		texelFetch(u_depth, ivec3(gl_FragCoord.xy, 1), 0).r,
		texelFetch(u_depth, ivec3(gl_FragCoord.xy, 2), 0).r,
		texelFetch(u_depth, ivec3(gl_FragCoord.xy, 3), 0).r
	);
}