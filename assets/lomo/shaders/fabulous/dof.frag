#include lomo:shaders/lib/linear.glsl
#include frex:shaders/lib/math.glsl
#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D u_color;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_color;

void main() {
	#ifdef DOF
	float depth0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 pos = vec3(gl_FragCoord.xy, depth0);
	vec3 pos_cam0 = win_to_cam(pos);

	vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
	vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

	vec4 near0 = frx_inverseProjectionMatrix * vec4(ndc_near, 1.0);
	vec4 far0  = frx_inverseProjectionMatrix * vec4(ndc_far, 1.0);
	vec3 near = near0.xyz / near0.w;
	vec3 far  = far0.xyz  / far0.w;

	vec3 dir = normalize(far - near);

	float center_depth = textureLod(u_depth, vec2(0.5), 4).x;
	vec4 center_cam0 = frx_inverseProjectionMatrix * vec4(0.0, 0.0, center_depth * 2.0 - 1.0, 1.0);
	vec3 center_cam = center_cam0.xyz / center_cam0.w;
	vec3 mid_cam = near + dir * -center_cam.z;

	vec3 color = vec3(0.0);
	float weight_sum = 0.0;

	const int s = 4;

	for(int x = -s; x <= s; ++x) {
		for(int y = -s; y <= s; ++y) {
			ivec2 ipos = ivec2(gl_FragCoord.xy) + ivec2(x, y);
			float depth = texelFetch(u_depth, ipos, 0).x;
			vec3 color0 = texelFetch(u_color, ipos, 0).rgb;

			vec3 pos = vec3(gl_FragCoord.xy + vec2(x, y), depth);
			vec3 pos_cam = win_to_cam(pos);

			float rad =
				min(
					abs(pos_cam.z - mid_cam.z) / abs(near.z -pos_cam.z) * 2.0,
					s
				);

			float weight =
				clamp(rad + 1.0 - length(vec2(x, y)), 0.0, 1.0);

			color += color0 * weight;
			weight_sum += weight;
		}
	}

	color /= weight_sum;

	out_color = vec3(color);
	#else
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	#endif
}