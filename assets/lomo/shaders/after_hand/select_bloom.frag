#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_color;

layout(location = 0) out vec3 out_selected;

void main() {
	vec3 bloom = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	//bloom = max(bloom, vec3(0.0));
	bloom = min(pow(bloom * BLOOM_INTENSITY * 1.0, vec3(2.0)), bloom);
	bloom = clamp(bloom, vec3(0.0), vec3(0.5));
	out_selected = bloom;
}