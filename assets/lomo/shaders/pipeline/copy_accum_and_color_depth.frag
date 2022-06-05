#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl

/* lomo:pipeline/copy.frag */

uniform sampler2D u_accum_next;
uniform sampler2D u_color_depth_next;

layout(location = 0) out vec4 out_accum;
layout(location = 1) out vec4 out_color_depth;

void main() {
	out_accum = texelFetch(u_accum_next, ivec2(gl_FragCoord.xy), 0);
	out_color_depth = texelFetch(u_color_depth_next, ivec2(gl_FragCoord.xy), 0);
}