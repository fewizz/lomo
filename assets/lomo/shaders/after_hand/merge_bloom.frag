#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_color;
uniform sampler2D u_bloom;

layout(location = 0) out vec3 out_color;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	vec3 bloom = texelFetch(u_bloom, ivec2(gl_FragCoord.xy), 0).rgb;

	out_color = out_color - min(pow(bloom * BLOOM_INTENSITY * 1.0, vec3(2.0)), out_color);
	out_color += bloom;
}