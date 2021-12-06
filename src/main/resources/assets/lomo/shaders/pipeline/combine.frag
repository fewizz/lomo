#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/blend.glsl
/* lomo:pipeline/combine.frag */

uniform sampler2DArray u_noise;
//uniform sampler2DArray u_noise_extra;
uniform sampler2D u_color;

layout(location = 0) out vec4 out_color;

void main() {
	ivec2 xy = ivec2(gl_FragCoord.xy);

	vec3 c = texelFetch(u_color, ivec2(xy), 0).rgb;
	vec3 n = texelFetch(u_noise, ivec3(xy, 0), 0).rgb;

	//float reflectivity = texelFetch(u_noise_extra, ivec3(xy, 0), 0)[0];
	float reflectivity = texelFetch(u_noise, ivec3(xy, 1), 0)[0];
	float block_light = texelFetch(u_noise, ivec3(xy, 1), 0)[2];

	out_color = vec4(n * mix(c, vec3(1), reflectivity) + c*block_light, 1.0);//vec4(c * n * (1.0 + block_light), 1.0);//vec4(mix(c, n, a), 1.0);//vec4(1. - exp(-5 * (c * n)), 1.0);
	
	//out_color.rgb *= 0.6;
	//out_color.rgb = 1.0 - exp(-0.5*out_color.rgb);
}