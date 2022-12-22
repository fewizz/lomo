#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

uniform sampler2D u_prev_ratio;
uniform sampler2D u_extra_0;

uniform sampler2D u_depth;
uniform sampler2D u_prev_depth;

uniform sampler2D u_normal;
uniform sampler2D u_prev_normal;

layout(location = 0) out float out_new_ratio;

float increase_ratio(float ratio, float mx) {
	float ratio_reverted = 1.0 / (1.0 - ratio);
	ratio_reverted += 1.0;
	ratio_reverted = min(ratio_reverted, mx);
	return 1.0 - 1.0 / ratio_reverted;
}

void main() {
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 pos_cam_0 = win_to_cam(pos_win_0);
	vec4 extras_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0);
	float roughness_0 = clamp(extras_0[0], 0.0, 1.0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	vec3 r_prev_pos_cam = vec3(pos_cam_0);
	vec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += vec3(frx_cameraPos) - vec3(frx_lastCameraPos);

	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, mat4(frx_lastViewMatrix)
	);
	vec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, mat4(frx_lastProjectionMatrix)
	);
	vec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	float prev_depth =
		//texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;
		texture(u_prev_depth, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).r;
	vec3 prev_normal =
		//texelFetch(u_prev_normal, ivec2(r_prev_pos_win.xy), 0).xyz;
		normalize(texture(u_prev_normal, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).xyz);
	vec3 normal = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	normal = normalize(normal);

	float ratio = texelFetch(u_prev_ratio, ivec2(r_prev_pos_win.xy), 0).r;
	ratio = max(ratio, 0.0);
	ratio = increase_ratio(ratio, 1024.0 * pow(roughness_0, 1.5));

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		ratio = 0.0;
	}
	else {
		float depth_diff = abs(prev_depth + 0.000001 - r_prev_pos_win.z);
		ratio *= max(1.0 - depth_diff * 1024.0, 0.0);

		vec3 prev_dir_inc_cam = cam_dir_to_z1(vec2(r_prev_pos_win.xy));
		prev_dir_inc_cam = mat3(frx_viewMatrix) * (prev_dir_inc_cam * mat3(frx_lastViewMatrix));
		prev_dir_inc_cam = normalize(prev_dir_inc_cam);

		ratio *= pow(
			max(0.0, dot(dir_inc_cam_0, prev_dir_inc_cam)),
			mix(1024.0, 64.0, roughness_0)
		);

		normal = normal * mat3(frx_viewMatrix);
		prev_normal = prev_normal * mat3(frx_lastViewMatrix);
		prev_normal = normalize(prev_normal);

		/*ratio *= pow(
			max(dot(normal, prev_normal), 0.0), mix(8.0, 1.0, roughness_0)
		);*/
	}

	ratio = clamp(ratio, 0.0, 1.0);
	out_new_ratio = ratio;
}