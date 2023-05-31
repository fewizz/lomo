#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_color;
uniform sampler2D u_bloom;

layout(location = 0) out vec3 out_color;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;

	vec3 bloom = texelFetch(u_bloom, ivec2(gl_FragCoord.xy), 0).rgb;
	out_color *= (1.0 - BLOOM_INTENSITY * 0.2);//min(vec3(0.6), light) + bloom;
	out_color += bloom;

	out_color = vec3(1.0) - exp(-out_color * 2.0);

	out_color = pow(out_color, vec3(1.0 / 2.2));
}