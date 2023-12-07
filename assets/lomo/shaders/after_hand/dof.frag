#include lomo:shaders/lib/linear.glsl
#include frex:shaders/lib/math.glsl
#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D u_color;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_color;

const float radius = 2.0;

const int steps = 21;
const ivec2[steps] positions = ivec2[steps](
	               ivec2(-2, -1), ivec2(-2, +0), ivec2(-2, +1),
	ivec2(-1, -2), ivec2(-1, -1), ivec2(-1, +0), ivec2(-1, +1), ivec2(-1, +2),
	ivec2(+0, -2), ivec2(+0, -1), ivec2(+0, +0), ivec2(+0, +1), ivec2(+0, +2),
	ivec2(+1, -2), ivec2(+1, -1), ivec2(+1, +0), ivec2(+1, +1), ivec2(+1, +2),
	               ivec2(+2, -1), ivec2(+2, +0), ivec2(+2, +1)
);

void main() {
	#define DOF
	#ifdef DOF
	float depth0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 pos = vec3(gl_FragCoord.xy, depth0);

	vec3 near = win_to_cam(vec3(gl_FragCoord.xy, 0.0));
	vec3 far  = win_to_cam(vec3(gl_FragCoord.xy, 1.0));

	float mid_depth = textureLod(u_depth, vec2(0.5), 4).x;

	vec3 color = vec3(0.0);
	float weight_sum = 0.0;

	vec3 mid_cam = win_to_cam(vec3(pos.xy, mid_depth));

	float near_to_mid_cam = distance(near.z, mid_cam.z);

	for(int stp = 0; stp < steps; ++stp) {
		ivec2 off = positions[stp];
		ivec2 ipos = ivec2(gl_FragCoord.xy) + off;
		float depth = texelFetch(u_depth, ipos, 0).x;
		vec3 color0 = texelFetch(u_color, ipos, 0).rgb;

		vec3 pos_cam = win_to_cam(vec3(gl_FragCoord.xy + vec2(off), depth));

		float pos_to_mid_cam = distance(pos_cam.z, mid_cam.z);
		float zero_to_pos = distance(0, pos_cam.z);

		float radius0 =
			min(
				distance(depth, mid_depth) / mid_depth * 200.0,
				//pos_to_mid_cam / zero_to_pos / near_to_mid_cam * 4.0,
				radius
			);

		float weight =
			clamp((radius0 + 0.5 - length(off)) * 2.0, 0.0, 1.0) *
			float(all(greaterThanEqual(ipos, ivec2(0)))) *
			float(all(lessThan(ipos, ivec2(frxu_size.xy))));

		color += color0 * weight;
		weight_sum += weight;
	}

	color /= weight_sum;

	out_color = vec3(color);
	#else
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	#endif
}