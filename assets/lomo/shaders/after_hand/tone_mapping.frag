#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_color;

uniform ivec2 frxu_size;

layout(location = 0) out vec3 out_color;


void main() {
	vec3 color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;

	float a = 2.51f;
	float b = 0.03f;
	float c = 2.43f;
	float d = 0.59f;
	float e = 0.14f;

	color = ((color*(a*color+b))/(color*(c*color+d)+e));
	color = pow(color, vec3(1.0 / 2.2));

	out_color = color;
}