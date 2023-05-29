#include canvas:shaders/pipeline/fog.glsl
#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/lib/color.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
#include lomo:shaders/lib/pack.glsl
#include lomo:shaders/lib/compute_normal.glsl

uniform samplerCube u_skybox;

uniform sampler2D u_prev_color;
uniform sampler2D u_prev_depth;

layout(location = 0) out vec4 out_color;

bool traverse(
	vec3 pos, vec3 dir, int steps, out ivec2 hit_pos, out float hit_z, out float hit_depth
) {
	const uint power_of_two = 2u;
	const uint last_level = 8u;

	pos.z -= max(0.0, dir.z * 4.0);
	pos.z -= 1.0 / 1000000.0;

	float dir_xy_length = length(dir.xy);
	vec2 dir_xy = dir.xy / dir_xy_length;
	vec2 sgn_xy = sign(dir_xy);
	dir_xy *= sgn_xy;
	ivec2 isgn_xy = ivec2(sgn_xy);

	// shift[x] is 1u if isgn_xy[i] is -1, 0u otherwise
	uvec2 shift = uvec2((-isgn_xy + 1) / 2);
	uvec2 texel = uvec2(ivec2(pos.xy * sgn_xy)) - shift;
	vec2 inner = fract(pos.xy * sgn_xy);
	float z = pos.z;

	while(steps > 0) {
		--steps;

		ivec2 itexel = ivec2(texel + shift) * isgn_xy;

		if( // check if out of buffer bounds
			any(greaterThanEqual(uvec2(itexel), uvec2(frx_viewWidth, frx_viewHeight))) ||
			z <= 0.0
		) {
			break;
		}

		uint level = last_level;
		float upper_depth = texelFetch(u_prev_depth, itexel >> last_level, int(last_level)).r;

		while(z >= upper_depth && level > 0u) {
			level -= power_of_two;
			upper_depth = texelFetch(u_prev_depth, itexel >> level, int(level)).r;
		}
		// position before advance
		uvec2 prev_texel = texel;
		vec2 prev_inner = inner;
		float prev_z = z;

		float dist_xy; { // advance, save travelled distance in dist_xy
			uint cell_size = 1u << level; // 1, 4, 16, etc...
			vec2 position_in_cell = (texel & (cell_size - 1u)) + inner;

			vec2 dists_to_axis = cell_size - position_in_cell;
			vec2 diagonal_dists = dists_to_axis / dir_xy;

			uint closest_dim = diagonal_dists.x < diagonal_dists.y ? 0u : 1u;
			dist_xy = diagonal_dists[closest_dim];

			texel[closest_dim] = ((texel[closest_dim] >> level) + 1u) << level;
			inner[closest_dim] = 0.0;

			uint farther_dim = 1u - closest_dim;
			float farther_dist = inner[farther_dim] + dir_xy[farther_dim] * dist_xy;
			uint ufarther_dist = uint(farther_dist);

			texel[farther_dim] += ufarther_dist;
			inner[farther_dim] = farther_dist - ufarther_dist;
		}
		// z addition = dir.z per len(dir.xy) * distance
		z += dist_xy * (dir.z / dir_xy_length);
		// we didn't hit upper depth yet, continue advancing
		if(z < upper_depth) continue;

		if(level == 0u) {
			hit_pos = itexel;
			hit_z = z;
			hit_depth = upper_depth;
			return true;
		}
		// restore position to hit point
		dist_xy *= (upper_depth - prev_z) / (z - prev_z);

		vec2 diff = prev_inner + dist_xy * dir_xy;
		uvec2 udiff = uvec2(diff);
		inner = diff - udiff;
		texel = prev_texel + udiff;

		z = upper_depth;
	}

	return false;
}

void frx_pipelineFragment() {
	vec3 vertex_normal = frx_vertexNormal;

	vertex_normal = normalize(vertex_normal);
	vec3 tangent = normalize(frx_vertexTangent.xyz);
	mat3 TBN = mat3(
		tangent,
		cross(vertex_normal, tangent),
		vertex_normal
	);

	vec3 frag_normal = TBN * frx_fragNormal;
	if(!frx_isHand) {
		frag_normal = mat3(frx_viewMatrix) * frag_normal;
	}

	frx_fragColor.rgb = pow(frx_fragColor.rgb, vec3(2.2));
	vec4 a = frx_fragColor;

	vec2 prev_light = frx_fragLight.xy;
	//frx_fragLight.xy = (frx_fragLight.xy - 0.03125) / (1.0 - 0.03125 - (1.0 - 0.96875));

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			float light = 0.4
				+ 0.6 * clamp(dot(vertex_normal.xyz, vec3(-0.93205774, 0.26230583, -0.24393857)), 0.0, 1.0)
				+ 0.6 * clamp(dot(vertex_normal.xyz, vec3(-0.10341814, 0.9751613, 0.18816751)), 0.0, 1.0);
			float df = min(light, 1.0);
			df = df + (1.0 - df) * frx_fragEmissive;
			df = pow(df, 2.2);
			a *= vec4(df, df, df, 1.0);
		}
	} else {
		float ao = pow(frx_fragLight.z, 3.0);
		//a.rgb *= frx_fragEnableAo ? vec3(ao) : vec3(1.0);

		vec3 block = texture(frxs_lightmap, vec2(prev_light.x, 0.03125)).rgb;

		vec3 dir; {
			vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
			vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

			vec4 near0 = frx_inverseProjectionMatrix * vec4(ndc_near, 1.0);
			vec4 far0  = frx_inverseProjectionMatrix * vec4(ndc_far, 1.0);
			vec3 near = near0.xyz / near0.w;
			vec3 far  = far0.xyz  / far0.w;
			dir = normalize(far - near);
		}

		/*vec3 changed_normal = compute_normal(
			dir, frag_normal, gl_FragCoord.xy, frx_fragRoughness, 0u
		);*/

		vec3 reflect_dir = reflect(dir, frag_normal);

		vec3 pos_win = gl_FragCoord.xyz;
		if(!frx_isHand) {
			pos_win.z = texelFetch(u_prev_depth, ivec2(gl_FragCoord.xy), 0).x;
		}
		vec3 ndc = pos_win / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		vec3 prev_reflect_dir = mat3(frx_lastViewMatrix) * (mat3(frx_inverseViewMatrix) * reflect_dir);
		vec4 d = frx_projectionMatrix * vec4(prev_reflect_dir, 0.0);
		vec3 dir_win = normalize(
			(d.xyz - ndc.xyz * d.w) * vec3(frx_viewWidth, frx_viewHeight, 1.0)
		);

		ivec2 hit_pos;
		float hit_z;
		float hit_depth;

		bool result = false;
		
		if(frx_fragRoughness <= 0.1) {
			result = traverse(pos_win, dir_win, 48, hit_pos, hit_z, hit_depth);
		}

		vec3 pos_at_depth = win_to_cam(vec3(vec2(hit_pos) + 0.5, hit_depth));
		vec3 pos_at_z = win_to_cam(vec3(vec2(hit_pos) + 0.5, hit_z));

		result = result &&
			result && hit_depth < 1.0 &&
			!(length(pos_at_z) > length(pos_at_depth) && distance(pos_at_z, pos_at_depth) > length(pos_at_depth) / 4.0);
		//a.rgb = texelFetch(u_prev_color, hit_pos, 0).rgb;

		vec3 reflected_color = vec3(0.0);

		if(result) {
			reflected_color = texelFetch(u_prev_color, hit_pos, 0).rgb;
		}
		else {
			reflected_color = textureLod(
				u_skybox,
				mat3(frx_inverseViewMatrix) * normalize(mix(reflect_dir, frag_normal, frx_fragRoughness)),
				pow(frx_fragRoughness, 1.0 / 6.0) * 7.0
			).rgb * pow(frx_fragLight.y, 4.0);
		}

		//if(result) {
		a = mix(
			vec4(reflected_color, 1.0),
			vec4(a.rgb * reflected_color, a.a),
			pow(
				max(0.0, dot(reflect_dir, frag_normal)),
				pow((1.0 - frx_fragRoughness), 4.0)
			)
		);

		a.rgb += frx_fragColor.rgb * mix(
			pow(frx_fragLight.x, 4.0) * block,
			frx_emissiveColor.rgb,
			frx_fragEmissive
		);

		if (frx_fragEnableAo) {
			a.rgb *= mix(1.0, ao, pow(frx_fragRoughness, 0.1) * (1.0 - frx_fragLight.x));
		}
	}

	if (frx_matFlash == 1) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt == 1) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	glintify(a, float(frx_matGlint));

	out_color = p_fog(a);
	out_color.rgb = pow(out_color.rgb, vec3(1.0 / 2.2));

	gl_FragDepth = gl_FragCoord.z;
}