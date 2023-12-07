#include lomo:shaders/lib/linear.glsl
#include frex:shaders/lib/math.glsl
#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D u_color;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_color;

/*const float radius = 2.0;
const int steps = 21;
const ivec2[steps] positions = ivec2[steps](
	               ivec2(-2, -1), ivec2(-2, +0), ivec2(-2, +1),
	ivec2(-1, -2), ivec2(-1, -1), ivec2(-1, +0), ivec2(-1, +1), ivec2(-1, +2),
	ivec2(+0, -2), ivec2(+0, -1), ivec2(+0, +0), ivec2(+0, +1), ivec2(+0, +2),
	ivec2(+1, -2), ivec2(+1, -1), ivec2(+1, +0), ivec2(+1, +1), ivec2(+1, +2),
	               ivec2(+2, -1), ivec2(+2, +0), ivec2(+2, +1)
);*/
const float radius = 3.0;
const int steps = 37;
const ivec2[steps] positions = ivec2[steps](
	                              ivec2(-3, -1), ivec2(-3,  0), ivec2(-3,  1),
	               ivec2(-2, -2), ivec2(-2, -1), ivec2(-2,  0), ivec2(-2,  1), ivec2(-2,  2),
	ivec2(-1, -3), ivec2(-1, -2), ivec2(-1, -1), ivec2(-1,  0), ivec2(-1,  1), ivec2(-1,  2), ivec2(-1,  3),
	ivec2( 0, -3), ivec2( 0, -2), ivec2( 0, -1), ivec2( 0,  0), ivec2( 0,  1), ivec2( 0,  2), ivec2( 0,  3),
	ivec2( 1, -3), ivec2( 1, -2), ivec2( 1, -1), ivec2( 1,  0), ivec2( 1,  1), ivec2( 1,  2), ivec2( 1,  3),
	               ivec2( 2, -2), ivec2( 2, -1), ivec2( 2,  0), ivec2( 2,  1), ivec2( 2,  2),
	                              ivec2( 3, -1), ivec2( 3,  0), ivec2( 3,  1)
);


void main() {
	#define DOF
	#ifdef DOF

	float mid_depth = textureLod(u_depth, vec2(0.5), 4).x;

	vec3 color_sum = vec3(0.0);
	float weight_sum = 0.0;

	for(int stp = 0; stp < steps; ++stp) {
		ivec2 off = positions[stp];
		ivec2 ipos = ivec2(gl_FragCoord.xy) + off;
		float depth = texelFetch(u_depth, ipos, 0).x;
		vec3 color = texelFetch(u_color, ipos, 0).rgb;

		float local_radius =
			min(
				distance(depth, mid_depth) / mid_depth * 100.0,
				radius
			);

		float weight =
			clamp((local_radius + 0.5 - length(off)) * 2.0, 0.0, 1.0) *
			float(all(greaterThanEqual(ipos, ivec2(0)))) *
			float(all(lessThan(ipos, ivec2(frxu_size.xy))));

		color_sum += color * weight;
		weight_sum += weight;
	}

	out_color = color_sum / weight_sum;
	#else
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	#endif
}