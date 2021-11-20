#include frex:shaders/api/header.glsl

/* lomo:pipeline/combine.frag */

uniform sampler2DArray u_noise;
uniform sampler2D u_color;

layout(location = 0) out vec4 out_color;

void main() {
	ivec2 xy = ivec2(gl_FragCoord.xy);

	vec3 c = texelFetch(u_color, ivec2(xy), 0).rgb;
	vec3 n = texelFetch(u_noise, ivec3(xy, 0), 0).rgb;

	out_color = vec4(1. - exp(-5 * (c * n)), 1.0);
}