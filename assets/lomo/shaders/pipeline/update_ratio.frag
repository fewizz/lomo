#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/ratio.glsl

uniform sampler2D u_prev_ratio;
uniform sampler2D u_extra_0;

uniform sampler2D u_depth;
uniform sampler2D u_prev_depth;

uniform sampler2D u_normal;
uniform sampler2D u_prev_normal;

layout(location = 0) out float out_new_ratio;

void main() {
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 pos_cam_0 = win_to_cam(pos_win_0);
	vec4 extras_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0);
	float roughness_0 = clamp(extras_0[0], 0.0, 1.0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	dvec3 r_prev_pos_cam = dvec3(pos_cam_0);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);

	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	float prev_depth =
		//texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;
		texture(u_prev_depth, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).r;
	vec3 prev_normal =
		//texelFetch(u_prev_normal, ivec2(r_prev_pos_win.xy), 0).xyz;
		normalize(texture(u_prev_normal, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).xyz);
	vec3 normal = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;

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
		double diff = abs(prev_depth - r_prev_pos_win.z);
		float depth_f = max(0.0, exp(-float(diff * 2048.0)));

		vec3 prev_dir_inc_cam = cam_dir_to_z1(vec2(r_prev_pos_win.xy));
		prev_dir_inc_cam = mat3(frx_viewMatrix) * (inverse(mat3(frx_lastViewMatrix)) * prev_dir_inc_cam);

		float sn_dir = length(cross(dir_inc_cam_0, prev_dir_inc_cam));
		ratio *= exp(-(1.5 * sn_dir / roughness_0));

		normal = inverse(mat3(frx_viewMatrix)) * normal;
		prev_normal = inverse(mat3(frx_lastViewMatrix)) * prev_normal;
		float sn_norm = length(cross(normal, prev_normal));
		float sn_f = 1.0;
		if(dot(prev_normal, prev_normal) > 0.9) {
			sn_f = exp(-(0.5 * sn_norm / roughness_0));
		}

		ratio *= min(depth_f, sn_f);
	}

	ratio = clamp(ratio, 0.0, 1.0);
	out_new_ratio = ratio;
}